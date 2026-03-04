import type { FC } from "react";
import { useTranslation } from "../../hooks/use-translation.ts";
import {
  createFieldSchema,
  type FieldDropTarget,
  type FieldMoveLocation,
  moveFieldInSchema,
  renameObjectProperty,
  updateObjectProperty,
  updatePropertyRequired,
} from "../../lib/schemaEditor.ts";
import type { JSONSchema, NewField } from "../../types/jsonSchema.ts";
import { asObjectSchema, isBooleanSchema } from "../../types/jsonSchema.ts";
import AddFieldButton from "./AddFieldButton.tsx";
import SchemaFieldList from "./SchemaFieldList.tsx";

/** @public */
export interface SchemaVisualEditorProps {
  schema: JSONSchema;
  readOnly: boolean;
  onChange: (schema: JSONSchema) => void;
  onFieldDrop?: (source: FieldMoveLocation, target: FieldDropTarget) => void;
}

/** @public */
const SchemaVisualEditor: FC<SchemaVisualEditorProps> = ({
  schema,
  onChange,
  readOnly = false,
  onFieldDrop,
}) => {
  const t = useTranslation();

  const handleAddField = (newField: NewField) => {
    const fieldSchema = createFieldSchema(newField);
    let newSchema = updateObjectProperty(
      asObjectSchema(schema),
      newField.name,
      fieldSchema,
    );
    if (newField.required) {
      newSchema = updatePropertyRequired(newSchema, newField.name, true);
    }
    onChange(newSchema);
  };

  const handleEditField = (name: string, updatedField: NewField) => {
    const fieldSchema = createFieldSchema(updatedField);
    let newSchema = asObjectSchema(schema);
    if (name !== updatedField.name) {
      newSchema = renameObjectProperty(newSchema, name, updatedField.name);
      newSchema = updateObjectProperty(newSchema, updatedField.name, fieldSchema);
    } else {
      newSchema = updateObjectProperty(newSchema, name, fieldSchema);
    }
    newSchema = updatePropertyRequired(
      newSchema,
      updatedField.name,
      updatedField.required || false,
    );
    onChange(newSchema);
  };

  const handleDeleteField = (name: string) => {
    if (isBooleanSchema(schema) || !schema.properties) return;
    const { [name]: _, ...remainingProps } = schema.properties;
    const newSchema = { ...schema, properties: remainingProps };
    if (newSchema.required) {
      newSchema.required = newSchema.required.filter((f) => f !== name);
    }
    onChange(newSchema);
  };

  const handleFieldDrop = (source: FieldMoveLocation, target: FieldDropTarget) => {
    const updated = moveFieldInSchema(schema, source, target);
    onChange(updated);
  };

  const hasFields =
    !isBooleanSchema(schema) &&
    schema.properties &&
    Object.keys(schema.properties).length > 0;

  return (
    <div className="p-4 h-full flex flex-col overflow-auto jsonjoy">
      {!readOnly && (
        <div className="mb-6 shrink-0">
          <AddFieldButton onAddField={handleAddField} />
        </div>
      )}

      <div className="grow overflow-auto">
        {!hasFields ? (
          <div className="text-center py-10 text-muted-foreground">
            <p className="mb-3">{t.visualEditorNoFieldsHint1}</p>
            <p className="text-sm">{t.visualEditorNoFieldsHint2}</p>
          </div>
        ) : (
          <SchemaFieldList
            schema={schema}
            readOnly={readOnly}
            onEditField={handleEditField}
            onDeleteField={handleDeleteField}
            parentPath={[]}
            onFieldDrop={onFieldDrop ?? handleFieldDrop}
          />
        )}
      </div>
    </div>
  );
};

export default SchemaVisualEditor;
