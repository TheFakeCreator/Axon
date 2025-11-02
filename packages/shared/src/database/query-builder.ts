/**
 * MongoDB query builder utilities
 */

import { Filter, FindOptions, Sort, UpdateFilter, Document } from 'mongodb';

/**
 * Query builder for MongoDB operations
 */
export class QueryBuilder<T extends Document> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private filter: any = {};
  private options: FindOptions<T> = {};

  /**
   * Add a field equals condition
   */
  where(field: keyof T | string, value: unknown): this {
    this.filter[field as string] = value;
    return this;
  }

  /**
   * Add an $in condition
   */
  whereIn(field: keyof T | string, values: unknown[]): this {
    this.filter[field as string] = { $in: values };
    return this;
  }

  /**
   * Add a $nin condition
   */
  whereNotIn(field: keyof T | string, values: unknown[]): this {
    this.filter[field as string] = { $nin: values };
    return this;
  }

  /**
   * Add a greater than condition
   */
  whereGreaterThan(field: keyof T | string, value: number | Date): this {
    this.filter[field as string] = { $gt: value };
    return this;
  }

  /**
   * Add a greater than or equal condition
   */
  whereGreaterThanOrEqual(field: keyof T | string, value: number | Date): this {
    this.filter[field as string] = { $gte: value };
    return this;
  }

  /**
   * Add a less than condition
   */
  whereLessThan(field: keyof T | string, value: number | Date): this {
    this.filter[field as string] = { $lt: value };
    return this;
  }

  /**
   * Add a less than or equal condition
   */
  whereLessThanOrEqual(field: keyof T | string, value: number | Date): this {
    this.filter[field as string] = { $lte: value };
    return this;
  }

  /**
   * Add a not equals condition
   */
  whereNotEquals(field: keyof T | string, value: unknown): this {
    this.filter[field as string] = { $ne: value };
    return this;
  }

  /**
   * Add a regex condition
   */
  whereRegex(field: keyof T | string, pattern: string | RegExp, options?: string): this {
    if (typeof pattern === 'string') {
      this.filter[field as string] = { $regex: pattern, $options: options || 'i' };
    } else {
      this.filter[field as string] = { $regex: pattern };
    }
    return this;
  }

  /**
   * Add an exists condition
   */
  whereExists(field: keyof T | string, exists = true): this {
    this.filter[field as string] = { $exists: exists };
    return this;
  }

  /**
   * Add a custom filter condition
   */
  whereCustom(customFilter: Filter<T>): this {
    this.filter = { ...this.filter, ...customFilter };
    return this;
  }

  /**
   * Add OR conditions
   */
  or(filters: Filter<T>[]): this {
    this.filter.$or = filters;
    return this;
  }

  /**
   * Add AND conditions
   */
  and(filters: Filter<T>[]): this {
    this.filter.$and = filters;
    return this;
  }

  /**
   * Set sort order
   */
  sort(sort: Sort): this {
    this.options.sort = sort;
    return this;
  }

  /**
   * Set limit
   */
  limit(limit: number): this {
    this.options.limit = limit;
    return this;
  }

  /**
   * Set skip
   */
  skip(skip: number): this {
    this.options.skip = skip;
    return this;
  }

  /**
   * Set projection
   */
  select(fields: (keyof T | string)[]): this {
    const projection: Record<string, number> = {};
    fields.forEach((field) => {
      projection[field as string] = 1;
    });
    this.options.projection = projection;
    return this;
  }

  /**
   * Exclude fields from results
   */
  exclude(fields: (keyof T | string)[]): this {
    const projection: Record<string, number> = {};
    fields.forEach((field) => {
      projection[field as string] = 0;
    });
    this.options.projection = projection;
    return this;
  }

  /**
   * Get the built filter
   */
  getFilter(): Filter<T> {
    return this.filter;
  }

  /**
   * Get the built options
   */
  getOptions(): FindOptions<T> {
    return this.options;
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.filter = {};
    this.options = {};
    return this;
  }
}

/**
 * Update builder for MongoDB update operations
 */
export class UpdateBuilder<T extends Document> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private update: any = {};

  /**
   * Set a field value
   */
  set(field: keyof T | string, value: unknown): this {
    if (!this.update.$set) {
      this.update.$set = {};
    }
    this.update.$set[field] = value;
    return this;
  }

  /**
   * Set multiple fields
   */
  setMultiple(fields: Partial<T>): this {
    if (!this.update.$set) {
      this.update.$set = {};
    }
    Object.assign(this.update.$set, fields);
    return this;
  }

  /**
   * Increment a field
   */
  increment(field: keyof T | string, value = 1): this {
    if (!this.update.$inc) {
      this.update.$inc = {};
    }
    this.update.$inc[field] = value;
    return this;
  }

  /**
   * Multiply a field
   */
  multiply(field: keyof T | string, value: number): this {
    if (!this.update.$mul) {
      this.update.$mul = {};
    }
    this.update.$mul[field] = value;
    return this;
  }

  /**
   * Rename a field
   */
  rename(oldField: keyof T | string, newField: string): this {
    if (!this.update.$rename) {
      this.update.$rename = {};
    }
    this.update.$rename[oldField] = newField;
    return this;
  }

  /**
   * Unset (remove) a field
   */
  unset(field: keyof T | string): this {
    if (!this.update.$unset) {
      this.update.$unset = {};
    }
    this.update.$unset[field] = '';
    return this;
  }

  /**
   * Push to an array
   */
  push(field: keyof T | string, value: unknown): this {
    if (!this.update.$push) {
      this.update.$push = {};
    }
    this.update.$push[field] = value;
    return this;
  }

  /**
   * Push multiple items to an array
   */
  pushEach(field: keyof T | string, values: unknown[]): this {
    if (!this.update.$push) {
      this.update.$push = {};
    }
    this.update.$push[field] = { $each: values };
    return this;
  }

  /**
   * Pull from an array
   */
  pull(field: keyof T | string, value: unknown): this {
    if (!this.update.$pull) {
      this.update.$pull = {};
    }
    this.update.$pull[field] = value;
    return this;
  }

  /**
   * Add to set (array, no duplicates)
   */
  addToSet(field: keyof T | string, value: unknown): this {
    if (!this.update.$addToSet) {
      this.update.$addToSet = {};
    }
    this.update.$addToSet[field] = value;
    return this;
  }

  /**
   * Set current date
   */
  currentDate(field: keyof T | string): this {
    if (!this.update.$currentDate) {
      this.update.$currentDate = {};
    }
    this.update.$currentDate[field] = true;
    return this;
  }

  /**
   * Set minimum value
   */
  min(field: keyof T | string, value: number | Date): this {
    if (!this.update.$min) {
      this.update.$min = {};
    }
    this.update.$min[field] = value;
    return this;
  }

  /**
   * Set maximum value
   */
  max(field: keyof T | string, value: number | Date): this {
    if (!this.update.$max) {
      this.update.$max = {};
    }
    this.update.$max[field] = value;
    return this;
  }

  /**
   * Get the built update
   */
  getUpdate(): UpdateFilter<T> {
    return this.update as UpdateFilter<T>;
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.update = {};
    return this;
  }
}

/**
 * Pagination helper
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Calculate pagination values
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): {
  skip: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
} {
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    skip,
    limit,
    totalPages,
    hasNext,
    hasPrev,
  };
}
