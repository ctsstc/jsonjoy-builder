import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDragState } from "./DragStateContext.tsx";
import { Input } from "../../components/ui/input.tsx";
import { useTranslation } from "../../hooks/use-translation.ts";
import type {
  FieldDropTarget,
  FieldMoveLocation,
} from "../../lib/schemaEditor.ts";
import { cn } from "../../lib/utils.ts";
import type {
  JSONSchema,
  ObjectJSONSchema,
  SchemaType,
} from "../../types/jsonSchema.ts";
import {
  asObjectSchema,
  getSchemaDescription,
  withObjectSchema,
} from "../../types/jsonSchema.ts";
import type { ValidationTreeNode } from "../../types/validation.ts";
import { Badge } from "../ui/badge.tsx";
import { ButtonToggle } from "../ui/button-toggle.tsx";
import TypeDropdown from "./TypeDropdown.tsx";
import TypeEditor from "./TypeEditor.tsx";

export interface SchemaPropertyEditorProps {
  name: string;
  schema: JSONSchema;
  required: boolean;
  readOnly: boolean;
  validationNode?: ValidationTreeNode;
  onDelete: () => void;
  onNameChange: (newName: string) => void;
  onRequiredChange: (required: boolean) => void;
  onSchemaChange: (schema: ObjectJSONSchema) => void;
  /**
   * Path to the object schema that owns this property.
   */
  parentPath: string[];
  depth?: number;
  /**
   * Centralized field drop handler, forwarded down to nested editors so
   * they can report drag-and-drop operations back to the visual editor.
   */
  onFieldDrop?: (source: FieldMoveLocation, target: FieldDropTarget) => void;
  /**
   * When true, the component is rendered inside DragOverlay (ghost clone).
   * In this mode useSortable is skipped and no drag interactions are set up.
   */
  isOverlay?: boolean;
}

export const SchemaPropertyEditor: React.FC<SchemaPropertyEditorProps> = ({
  name,
  schema,
  required,
  readOnly = false,
  validationNode,
  onDelete,
  onNameChange,
  onRequiredChange,
  onSchemaChange,
  parentPath,
  depth = 0,
  onFieldDrop,
  isOverlay = false,
}) => {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [tempName, setTempName] = useState(name);
  const [tempDesc, setTempDesc] = useState(getSchemaDescription(schema));

  const type = withObjectSchema(
    schema,
    (s) => (s.type || "object") as SchemaType,
    "object" as SchemaType,
  );

  // Unique sortable ID: parentPath joined + field name
  const sortableId = [...parentPath, name].join("/") || name;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    disabled: readOnly || isOverlay,
    data: {
      parentPath,
      name,
      propertySchema: schema,
      required,
    },
  });

  // When this item is being dragged, the DragOverlay follows the cursor.
  // Don't apply the sortable transform to the original element — it should
  // stay put as a faded placeholder, not teleport to a new position.
  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  const { overId, overPosition } = useDragState();
  const isDropTarget = !isOverlay && overId === sortableId;

  // Update temp values when props change
  useEffect(() => {
    setTempName(name);
    setTempDesc(getSchemaDescription(schema));
  }, [name, schema]);

  const handleNameSubmit = () => {
    const trimmedName = tempName.trim();
    if (trimmedName && trimmedName !== name) {
      onNameChange(trimmedName);
    } else {
      setTempName(name);
    }
    setIsEditingName(false);
  };

  const handleDescSubmit = () => {
    const trimmedDesc = tempDesc.trim();
    if (trimmedDesc !== getSchemaDescription(schema)) {
      onSchemaChange({
        ...asObjectSchema(schema),
        description: trimmedDesc || undefined,
      });
    } else {
      setTempDesc(getSchemaDescription(schema));
    }
    setIsEditingDesc(false);
  };

  const handleSchemaUpdate = (updatedSchema: ObjectJSONSchema) => {
    const description = getSchemaDescription(schema);
    onSchemaChange({
      ...updatedSchema,
      description: description || undefined,
    });
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isDropTarget && overPosition === "top" && (
        <div className="absolute left-0 right-0 -top-1 h-0.5 bg-primary rounded-full z-10 pointer-events-none" />
      )}
      <fieldset
        className={cn(
          "mb-2 animate-in rounded-lg border transition-all duration-200",
          depth > 0 && "ml-0 sm:ml-4 border-l border-l-border/40",
          isDragging && "opacity-50",
          isOverlay && "shadow-lg ring-2 ring-primary/30 bg-background",
          isDropTarget && "border-primary ring-2 ring-primary/20",
        )}
      >
        <div className="relative json-field-row justify-between group">
          <div className="flex items-center gap-2 grow min-w-0">
            {/* Drag handle */}
            {!readOnly && (
              <button
                type="button"
                aria-label="Drag to reorder field"
                className="cursor-grab active:cursor-grabbing text-foreground transition-colors p-1 rounded hover:bg-secondary/50"
                {...attributes}
                {...listeners}
              >
                <GripVertical size={16} />
              </button>
            )}

            {/* Expand/collapse button */}
            <button
              type="button"
              className="text-foreground transition-colors"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? t.collapse : t.expand}
            >
              {expanded ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>

            {/* Property name */}
            <div className="flex items-center gap-2 grow min-w-0 overflow-visible">
              <div className="flex items-center gap-2 min-w-0 grow overflow-visible">
                {!readOnly && isEditingName ? (
                  <Input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={handleNameSubmit}
                    onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                    className="h-8 text-sm font-medium min-w-[120px] max-w-full z-10"
                    autoFocus
                    onFocus={(e) => e.target.select()}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && setIsEditingName(true)
                    }
                    className="json-field-label font-medium cursor-text px-2 py-0.5 -mx-0.5 rounded-sm hover:bg-secondary/30 hover:shadow-xs hover:ring-1 hover:ring-ring/20 transition-all text-left truncate min-w-[80px] max-w-[50%]"
                  >
                    {name}
                  </button>
                )}

                {/* Description */}
                {!readOnly && isEditingDesc ? (
                  <Input
                    value={tempDesc}
                    onChange={(e) => setTempDesc(e.target.value)}
                    onBlur={handleDescSubmit}
                    onKeyDown={(e) => e.key === "Enter" && handleDescSubmit()}
                    placeholder={t.propertyDescriptionPlaceholder}
                    className="h-8 text-xs text-muted-foreground italic flex-1 min-w-[150px] z-10"
                    autoFocus
                    onFocus={(e) => e.target.select()}
                  />
                ) : tempDesc ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingDesc(true)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && setIsEditingDesc(true)
                    }
                    className="text-xs text-muted-foreground italic cursor-text px-2 py-0.5 -mx-0.5 rounded-sm hover:bg-secondary/30 hover:shadow-xs hover:ring-1 hover:ring-ring/20 transition-all text-left truncate flex-1 max-w-[40%] mr-2"
                  >
                    {tempDesc}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingDesc(true)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && setIsEditingDesc(true)
                    }
                    className="text-xs text-muted-foreground/50 italic cursor-text px-2 py-0.5 -mx-0.5 rounded-sm hover:bg-secondary/30 hover:shadow-xs hover:ring-1 hover:ring-ring/20 transition-all opacity-0 group-hover:opacity-100 text-left truncate flex-1 max-w-[40%] mr-2"
                  >
                    {t.propertyDescriptionButton}
                  </button>
                )}
              </div>

              {/* Type display */}
              <div className="flex items-center gap-2 justify-end shrink-0">
                <TypeDropdown
                  value={type}
                  readOnly={readOnly}
                  onChange={(newType) => {
                    onSchemaChange({
                      ...asObjectSchema(schema),
                      type: newType,
                    });
                  }}
                />

                {/* Required toggle */}
                <ButtonToggle
                  onClick={() => !readOnly && onRequiredChange(!required)}
                  className={
                    required
                      ? "bg-red-50 text-red-500"
                      : "bg-secondary text-muted-foreground"
                  }
                >
                  {required ? t.propertyRequired : t.propertyOptional}
                </ButtonToggle>
              </div>
            </div>
          </div>

          {/* Error badge */}
          {validationNode?.cumulativeChildrenErrors > 0 && (
            <Badge
              className="h-5 min-w-5 rounded-full px-1 font-mono tabular-nums justify-center"
              variant="destructive"
            >
              {validationNode.cumulativeChildrenErrors}
            </Badge>
          )}

          {/* Delete button */}
          {!readOnly && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <button
                type="button"
                onClick={onDelete}
                className="p-1 rounded-md hover:bg-secondary hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                aria-label={t.propertyDelete}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Type-specific editor */}
        {expanded && !isOverlay && (
          <div className="pt-1 pb-2 px-2 sm:px-3 animate-in">
            {readOnly && tempDesc && <p className="pb-2">{tempDesc}</p>}
            <TypeEditor
              schema={schema}
              readOnly={readOnly}
              validationNode={validationNode}
              onChange={handleSchemaUpdate}
              depth={depth + 1}
              path={[...parentPath, "properties", name]}
              onFieldDrop={onFieldDrop}
            />
          </div>
        )}
      </fieldset>
      {isDropTarget && overPosition === "bottom" && (
        <div className="absolute left-0 right-0 -bottom-1 h-0.5 bg-primary rounded-full z-10 pointer-events-none" />
      )}
    </div>
  );
};

export default SchemaPropertyEditor;
