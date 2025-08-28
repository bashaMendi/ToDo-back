import { exportSearchSchema } from './src/validation/schemas';

const testQuery = {
  query: undefined,
  page: 1,
  limit: 1000,
  sort: 'updatedAt:desc' as const,
  context: 'mine' as const,
};

try {
  const result = exportSearchSchema.parse(testQuery);
      console.log('Schema validation passed:', result);
  } catch (error) {
    console.log('Schema validation failed:', error);
}
