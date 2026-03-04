import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { type FC, useMemo } from "react";
import { useDragState } from "./DragStateContext.tsx";
import { useTranslation } from "../../hooks/use-translation.ts";
import {
  type FieldDropTarget,
  type FieldMoveLocation,
  getSchemaProperties,
} from "../../lib/schemaEditor.ts";
import type {
  JSONSchema as JSONSchemaType,
  NewField,
  ObjectJSONSchema,
  SchemaType,
} from "../../types/jsonSchema.ts";
import { buildValidationTree } from "../../types/validation.ts";
import SchemaPropertyEditor from "./SchemaPropertyEditor.tsx";

interface SchemaFieldListProps {
  schema: JSONSchemaType;
  readOnly: boolean;
  onEditField: (name: string, updatedField: NewField) => void;
  onDeleteField: (name: string) => void;
  parentPath: string[];
  onFieldDrop?: (source: FieldMoveLocation, target: FieldDropTarget) => void;
}

const SchemaFieldList: FC<SchemaFieldListProps> = ({
  schema,
  onEditField,
  onDeleteField,
  readOnly = false,
  parentPath,
  onFieldDrop,
}) => {
  const t = useTranslation();

  const properties = getSchemaProperties(schema);

  const getValidSchemaType = (propSchema: JSONSchemaType): SchemaType => {
    if (typeof propSchema === "boolean") return "object";
    const type = propSchema.type;
    if (Array.isArray(type)) return type[0] || "object";
    return type || "object";
  };

  const handleNameChange = (oldName: string, newName: string) => {
    const property = properties.find((prop) => prop.name === oldName);
    if (!property) return;

    onEditField(oldName, {
      name: newName,
      type: getValidSchemaType(property.schema),
      description:
        typeof property.schema === "boolean"
          ? ""
          : property.schema.description || "",
      required: property.required,
      validation:
        typeof property.schema === "boolean"
          ? { type: "object" }
          : property.schema,
    });
  };

  const handleRequiredChange = (name: string, required: boolean) => {
    const property = properties.find((prop) => prop.name === name);
    if (!property) return;

    onEditField(name, {
      name,
      type: getValidSchemaType(property.schema),
      description:
        typeof property.schema === "boolean"
          ? ""
          : property.schema.description || "",
      required,
      validation:
        typeof property.schema === "boolean"
          ? { type: "object" }
          : property.schema,
    });
  };

  const handleSchemaChange = (
    name: string,
    updatedSchema: ObjectJSONSchema,
  ) => {
    const property = properties.find((prop) => prop.name === name);
    if (!property) return;

    const type = updatedSchema.type || "object";
    const validType = Array.isArray(type) ? type[0] || "object" : type;

    onEditField(name, {
      name,
      type: validType,
      description: updatedSchema.description || "",
      required: property.required,
      validation: updatedSchema,
    });
  };

  const validationTree = useMemo(
    () => buildValidationTree(schema, t),
    [schema, t],
  );

  const { activeId, overId } = useDragState();

  // Sortable IDs: match the format used in SchemaPropertyEditor (parentPath + name)
  const sortableIds = properties.map(
    (p) => [...parentPath, p.name].join("/") || p.name,
  );

  // Apply live optimistic reordering so sibling items animate during drag.
  // Only reorder when both active and over belong to this container.
  const liveIds = useMemo(() => {
    if (!activeId || !overId) return sortableIds;
    const activeIdx = sortableIds.indexOf(activeId);
    const overIdx = sortableIds.indexOf(overId);
    if (activeIdx === -1 || overIdx === -1) return sortableIds;
    return arrayMove(sortableIds, activeIdx, overIdx);
  }, [sortableIds, activeId, overId]);

  return (
    <SortableContext items={liveIds} strategy={verticalListSortingStrategy}>
      <section className="space-y-2 animate-in pt-2" aria-label="Field list">
        {properties.map((property) => (
          <SchemaPropertyEditor
            key={property.name}
            name={property.name}
            schema={property.schema}
            required={property.required}
            validationNode={validationTree.children[property.name] ?? undefined}
            onDelete={() => onDeleteField(property.name)}
            onNameChange={(newName) => handleNameChange(property.name, newName)}
            onRequiredChange={(required) =>
              handleRequiredChange(property.name, required)
            }
            onSchemaChange={(schema) => handleSchemaChange(property.name, schema)}
            readOnly={readOnly}
            parentPath={parentPath}
            onFieldDrop={onFieldDrop}
          />
        ))}
      </section>
    </SortableContext>
  );
};

export default SchemaFieldList;
