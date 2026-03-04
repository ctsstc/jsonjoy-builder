import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Maximize2 } from "lucide-react";
import {
  type FC,
  type MouseEvent as ReactMouseEvent,
  useRef,
  useState,
} from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs.tsx";
import { useTranslation } from "../../hooks/use-translation.ts";
import {
  type FieldDropTarget,
  type FieldMoveLocation,
  moveFieldInSchema,
} from "../../lib/schemaEditor.ts";
import { cn } from "../../lib/utils.ts";
import type { JSONSchema } from "../../types/jsonSchema.ts";
import { isBooleanSchema } from "../../types/jsonSchema.ts";
import { DragStateProvider, useDragState } from "./DragStateContext.tsx";
import JsonSchemaVisualizer from "./JsonSchemaVisualizer.tsx";
import { SchemaPropertyEditor } from "./SchemaPropertyEditor.tsx";
import SchemaVisualEditor from "./SchemaVisualEditor.tsx";

/** @public */
export interface JsonSchemaEditorProps {
  schema?: JSONSchema;
  readOnly: boolean;
  setSchema?: (schema: JSONSchema) => void;
  className?: string;
}

const JsonSchemaEditorInner: FC<JsonSchemaEditorProps> = ({
  schema = { type: "object" },
  readOnly = false,
  setSchema,
  className,
}) => {
  const t = useTranslation();
  const { setActive, setOver } = useDragState();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const resizeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanelDraggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Cross-container collision detection:
  // - Use pointerWithin for global hit detection across all SortableContexts
  // - Filter out droppables that are ancestors of the active item (e.g. dragging
  //   "person/firstName" should not land on "person" — the parent container)
  // - Fall back to rectIntersection then closestCenter
  const collisionDetection: CollisionDetection = (args) => {
    const activeId = args.active.id as string;
    const isAncestor = (candidateId: string) =>
      activeId !== candidateId && activeId.startsWith(candidateId + "/");

    const filter = <T extends { id: string | number }>(hits: T[]) =>
      hits.filter(h => !isAncestor(String(h.id)));

    const pointerHits = filter(pointerWithin(args));
    if (pointerHits.length > 0) return pointerHits;
    const rectHits = filter(rectIntersection(args));
    if (rectHits.length > 0) return rectHits;
    return filter(closestCenter(args));
  };

  const handleSchemaChange = (newSchema: JSONSchema) => {
    setSchema?.(newSchema);
  };

  const handleFieldDrop = (source: FieldMoveLocation, target: FieldDropTarget) => {
    const updated = moveFieldInSchema(schema, source, target);
    handleSchemaChange(updated);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    setActive(id);
    setOver(null, null);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setOver(null, null);
      return;
    }

    const activeSortable = active.data.current?.sortable as { index: number } | undefined;
    const overSortable = over.data.current?.sortable as { index: number } | undefined;
    const activeParentPath = active.data.current?.parentPath as string[] | undefined;
    const overParentPath = over.data.current?.parentPath as string[] | undefined;

    let position: "top" | "bottom" = "bottom";
    if (
      activeSortable &&
      overSortable &&
      JSON.stringify(activeParentPath) === JSON.stringify(overParentPath)
    ) {
      position = activeSortable.index < overSortable.index ? "bottom" : "top";
    }

    setOver(over.id as string, position);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActive(null);
    setOver(null, null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as { parentPath: string[]; name: string } | undefined;
    const overData = over.data.current as { parentPath: string[]; name: string } | undefined;
    if (!activeData || !overData) return;

    const activeSortable = active.data.current?.sortable as { index: number } | undefined;
    const overSortable = over.data.current?.sortable as { index: number } | undefined;

    let position: "top" | "bottom" = "bottom";
    if (
      activeSortable &&
      overSortable &&
      JSON.stringify(activeData.parentPath) === JSON.stringify(overData.parentPath)
    ) {
      position = activeSortable.index < overSortable.index ? "bottom" : "top";
    }

    handleFieldDrop(
      { parentPath: activeData.parentPath, name: activeData.name },
      { parentPath: overData.parentPath, anchorName: overData.name, position },
    );
  };

  // Find active item for DragOverlay — search all nested paths via activeId
  const activeProperty = (() => {
    if (!activeId || isBooleanSchema(schema)) return null;
    // activeId is "seg1/seg2/.../fieldName" — reconstruct path
    const parts = activeId.split("/");
    const name = parts.pop();
    if (!name) return null;
    // Walk the schema to find the owning object
    let current: JSONSchema = schema;
    for (const seg of parts) {
      if (typeof current === "boolean" || !current[seg]) return null;
      current = current[seg] as JSONSchema;
    }
    if (typeof current === "boolean" || !current.properties?.[name]) return null;
    const propSchema = current.properties[name];
    const required = Array.isArray(current.required) && current.required.includes(name);
    return { name, schema: propSchema, required };
  })();

  const toggleFullscreen = () => setIsFullscreen((v) => !v);
  const fullscreenClass = isFullscreen ? "fixed inset-0 z-50 bg-background" : "";

  const handleMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    isPanelDraggingRef.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isPanelDraggingRef.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    if (newWidth >= 20 && newWidth <= 80) setLeftPanelWidth(newWidth);
  };

  const handleMouseUp = () => {
    isPanelDraggingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          "json-editor-container w-full",
          fullscreenClass,
          className,
          "jsonjoy",
        )}
      >
        {/* Mobile: tabs */}
        <div className="block lg:hidden w-full">
          <Tabs defaultValue="visual" className="w-full">
            <div className="flex items-center justify-between px-4 py-3 border-b w-full">
              <h3 className="font-medium">{t.schemaEditorTitle}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                  aria-label={t.schemaEditorToggleFullscreen}
                >
                  <Maximize2 size={16} />
                </button>
                <TabsList className="grid grid-cols-2 w-[200px]">
                  <TabsTrigger value="visual">{t.schemaEditorEditModeVisual}</TabsTrigger>
                  <TabsTrigger value="json">{t.schemaEditorEditModeJson}</TabsTrigger>
                </TabsList>
              </div>
            </div>
            <TabsContent
              value="visual"
              className={cn("focus:outline-hidden w-full", isFullscreen ? "h-screen" : "h-[500px]")}
            >
              <SchemaVisualEditor
                readOnly={readOnly}
                schema={schema}
                onChange={handleSchemaChange}
                onFieldDrop={handleFieldDrop}
              />
            </TabsContent>
            <TabsContent
              value="json"
              className={cn("focus:outline-hidden w-full", isFullscreen ? "h-screen" : "h-[500px]")}
            >
              <JsonSchemaVisualizer schema={schema} onChange={handleSchemaChange} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop: side by side */}
        <div
          ref={containerRef}
          className={cn(
            "hidden lg:flex lg:flex-col w-full",
            isFullscreen ? "h-screen" : "h-[600px]",
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b w-full shrink-0">
            <h3 className="font-medium">{t.schemaEditorTitle}</h3>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-md hover:bg-secondary transition-colors"
              aria-label={t.schemaEditorToggleFullscreen}
            >
              <Maximize2 size={16} />
            </button>
          </div>
          <div className="flex flex-row w-full grow min-h-0">
            <div className="h-full min-h-0" style={{ width: `${leftPanelWidth}%` }}>
              <SchemaVisualEditor
                readOnly={readOnly}
                schema={schema}
                onChange={handleSchemaChange}
                onFieldDrop={handleFieldDrop}
              />
            </div>
            {/** biome-ignore lint/a11y/noStaticElementInteractions: What exactly does this div do? */}
            <div
              ref={resizeRef}
              className="w-1 bg-border hover:bg-primary cursor-col-resize shrink-0"
              onMouseDown={handleMouseDown}
            />
            <div className="h-full min-h-0" style={{ width: `${100 - leftPanelWidth}%` }}>
              <JsonSchemaVisualizer schema={schema} onChange={handleSchemaChange} />
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeProperty ? (
          <SchemaPropertyEditor
            name={activeProperty.name}
            schema={activeProperty.schema}
            required={activeProperty.required}
            readOnly={true}
            parentPath={[]}
            onDelete={() => {}}
            onNameChange={() => {}}
            onRequiredChange={() => {}}
            onSchemaChange={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

/** @public */
const JsonSchemaEditor: FC<JsonSchemaEditorProps> = (props) => (
  <DragStateProvider>
    <JsonSchemaEditorInner {...props} />
  </DragStateProvider>
);

export default JsonSchemaEditor;
