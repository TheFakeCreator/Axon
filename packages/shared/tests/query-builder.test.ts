/**
 * Tests for database query builder
 */

import { describe, it, expect } from 'vitest';
import { QueryBuilder, UpdateBuilder, calculatePagination } from '../src/database/query-builder';
import { Document } from 'mongodb';

interface TestDocument extends Document {
  name: string;
  age: number;
  email: string;
  tags: string[];
  createdAt: Date;
}

describe('QueryBuilder', () => {
  it('should build a simple where filter', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.where('name', 'John');

    expect(builder.getFilter()).toEqual({ name: 'John' });
  });

  it('should build a whereIn filter', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.whereIn('tags', ['admin', 'user']);

    expect(builder.getFilter()).toEqual({ tags: { $in: ['admin', 'user'] } });
  });

  it('should build a whereGreaterThan filter', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.whereGreaterThan('age', 18);

    expect(builder.getFilter()).toEqual({ age: { $gt: 18 } });
  });

  it('should build a whereLessThanOrEqual filter', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.whereLessThanOrEqual('age', 65);

    expect(builder.getFilter()).toEqual({ age: { $lte: 65 } });
  });

  it('should build a whereRegex filter', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.whereRegex('email', '@example.com');

    expect(builder.getFilter()).toEqual({ email: { $regex: '@example.com', $options: 'i' } });
  });

  it('should build a whereExists filter', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.whereExists('email', true);

    expect(builder.getFilter()).toEqual({ email: { $exists: true } });
  });

  it('should chain multiple conditions', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.where('name', 'John').whereGreaterThan('age', 18).whereExists('email', true);

    expect(builder.getFilter()).toEqual({
      name: 'John',
      age: { $gt: 18 },
      email: { $exists: true },
    });
  });

  it('should build OR filters', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.or([{ name: 'John' }, { name: 'Jane' }]);

    expect(builder.getFilter()).toEqual({
      $or: [{ name: 'John' }, { name: 'Jane' }],
    });
  });

  it('should set sort options', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.sort({ createdAt: -1 });

    expect(builder.getOptions()).toEqual({ sort: { createdAt: -1 } });
  });

  it('should set limit and skip', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.limit(10).skip(20);

    expect(builder.getOptions()).toEqual({ limit: 10, skip: 20 });
  });

  it('should select specific fields', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.select(['name', 'email']);

    expect(builder.getOptions()).toEqual({
      projection: { name: 1, email: 1 },
    });
  });

  it('should exclude specific fields', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.exclude(['password']);

    expect(builder.getOptions()).toEqual({
      projection: { password: 0 },
    });
  });

  it('should reset the builder', () => {
    const builder = new QueryBuilder<TestDocument>();
    builder.where('name', 'John').limit(10);
    builder.reset();

    expect(builder.getFilter()).toEqual({});
    expect(builder.getOptions()).toEqual({});
  });
});

describe('UpdateBuilder', () => {
  it('should build a $set update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.set('name', 'John');

    expect(builder.getUpdate()).toEqual({ $set: { name: 'John' } });
  });

  it('should build a setMultiple update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.setMultiple({ name: 'John', age: 30 });

    expect(builder.getUpdate()).toEqual({ $set: { name: 'John', age: 30 } });
  });

  it('should build an $inc update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.increment('age', 1);

    expect(builder.getUpdate()).toEqual({ $inc: { age: 1 } });
  });

  it('should build a $mul update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.multiply('age', 2);

    expect(builder.getUpdate()).toEqual({ $mul: { age: 2 } });
  });

  it('should build a $rename update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.rename('name', 'fullName');

    expect(builder.getUpdate()).toEqual({ $rename: { name: 'fullName' } });
  });

  it('should build a $unset update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.unset('email');

    expect(builder.getUpdate()).toEqual({ $unset: { email: '' } });
  });

  it('should build a $push update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.push('tags', 'admin');

    expect(builder.getUpdate()).toEqual({ $push: { tags: 'admin' } });
  });

  it('should build a $push with $each update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.pushEach('tags', ['admin', 'user']);

    expect(builder.getUpdate()).toEqual({ $push: { tags: { $each: ['admin', 'user'] } } });
  });

  it('should build a $pull update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.pull('tags', 'admin');

    expect(builder.getUpdate()).toEqual({ $pull: { tags: 'admin' } });
  });

  it('should build an $addToSet update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.addToSet('tags', 'admin');

    expect(builder.getUpdate()).toEqual({ $addToSet: { tags: 'admin' } });
  });

  it('should build a $currentDate update', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.currentDate('updatedAt');

    expect(builder.getUpdate()).toEqual({ $currentDate: { updatedAt: true } });
  });

  it('should chain multiple operations', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.set('name', 'John').increment('age', 1).push('tags', 'admin');

    expect(builder.getUpdate()).toEqual({
      $set: { name: 'John' },
      $inc: { age: 1 },
      $push: { tags: 'admin' },
    });
  });

  it('should reset the builder', () => {
    const builder = new UpdateBuilder<TestDocument>();
    builder.set('name', 'John');
    builder.reset();

    expect(builder.getUpdate()).toEqual({});
  });
});

describe('calculatePagination', () => {
  it('should calculate pagination for first page', () => {
    const result = calculatePagination(1, 10, 100);

    expect(result).toEqual({
      skip: 0,
      limit: 10,
      totalPages: 10,
      hasNext: true,
      hasPrev: false,
    });
  });

  it('should calculate pagination for middle page', () => {
    const result = calculatePagination(5, 10, 100);

    expect(result).toEqual({
      skip: 40,
      limit: 10,
      totalPages: 10,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('should calculate pagination for last page', () => {
    const result = calculatePagination(10, 10, 100);

    expect(result).toEqual({
      skip: 90,
      limit: 10,
      totalPages: 10,
      hasNext: false,
      hasPrev: true,
    });
  });

  it('should calculate pagination for partial last page', () => {
    const result = calculatePagination(3, 10, 25);

    expect(result).toEqual({
      skip: 20,
      limit: 10,
      totalPages: 3,
      hasNext: false,
      hasPrev: true,
    });
  });
});
