import { getPath } from 'ts-object-path';

import {
  IQueryBuilder,
  IFireOrmQueryLine,
  IOrderByParams,
  IFirestoreVal,
  FirestoreOperators,
  IQueryExecutor,
  IEntity,
  IWherePropParam,
  ICustomQuery,
  IQueryCursor,
} from './types';

export class QueryBuilder<T extends IEntity> implements IQueryBuilder<T> {
  protected queries: Array<IFireOrmQueryLine> = [];
  protected limitVal: number;
  protected orderByObj: IOrderByParams;
  protected customQueryFunction?: ICustomQuery<T>;
  protected orderByFields: Set<string> = new Set();
  protected startAtVal: any[];
  protected startAfterVal: any[];
  protected endAtVal: any[];
  protected endBeforeVal: any[];
  protected offsetVal: number;

  constructor(protected executor: IQueryExecutor<T>) {}

  private extractWhereParam = (param: IWherePropParam<T>) => {
    if (typeof param === 'string') return param;
    return getPath<T, (t: T) => unknown>(param).join('.');
  };

  private createCursor = (): IQueryCursor => ({
    startAt: this.startAtVal,
    startAfter: this.startAfterVal,
    endAt: this.endAtVal,
    endBefore: this.endBeforeVal,
  });

  whereEqualTo(param: IWherePropParam<T>, val: IFirestoreVal) {
    this.queries.push({
      prop: this.extractWhereParam(param),
      val,
      operator: FirestoreOperators.equal,
    });
    return this;
  }

  whereNotEqualTo(param: IWherePropParam<T>, val: IFirestoreVal) {
    this.queries.push({
      prop: this.extractWhereParam(param),
      val,
      operator: FirestoreOperators.notEqual,
    });
    return this;
  }

  whereGreaterThan(prop: IWherePropParam<T>, val: IFirestoreVal) {
    this.queries.push({
      prop: this.extractWhereParam(prop),
      val,
      operator: FirestoreOperators.greaterThan,
    });
    return this;
  }

  whereGreaterOrEqualThan(prop: IWherePropParam<T>, val: IFirestoreVal) {
    this.queries.push({
      prop: this.extractWhereParam(prop),
      val,
      operator: FirestoreOperators.greaterThanEqual,
    });
    return this;
  }

  whereLessThan(prop: IWherePropParam<T>, val: IFirestoreVal) {
    this.queries.push({
      prop: this.extractWhereParam(prop),
      val,
      operator: FirestoreOperators.lessThan,
    });
    return this;
  }

  whereLessOrEqualThan(prop: IWherePropParam<T>, val: IFirestoreVal) {
    this.queries.push({
      prop: this.extractWhereParam(prop),
      val,
      operator: FirestoreOperators.lessThanEqual,
    });
    return this;
  }

  whereArrayContains(prop: IWherePropParam<T>, val: IFirestoreVal) {
    this.queries.push({
      prop: this.extractWhereParam(prop),
      val,
      operator: FirestoreOperators.arrayContains,
    });
    return this;
  }

  whereArrayContainsAny(prop: IWherePropParam<T>, val: IFirestoreVal[]) {
    if (val.length > 10) {
      throw new Error(`
        This query supports up to 10 values. You provided ${val.length}.
        For details please visit: https://firebase.google.com/docs/firestore/query-data/queries#in_not-in_and_array-contains-any
      `);
    }
    this.queries.push({
      prop: this.extractWhereParam(prop),
      val,
      operator: FirestoreOperators.arrayContainsAny,
    });
    return this;
  }

  whereIn(prop: IWherePropParam<T>, val: IFirestoreVal[]) {
    if (val.length > 10) {
      throw new Error(`
        This query supports up to 10 values. You provided ${val.length}.
        For details please visit: https://firebase.google.com/docs/firestore/query-data/queries#in_not-in_and_array-contains-any
      `);
    }
    this.queries.push({
      prop: this.extractWhereParam(prop),
      val,
      operator: FirestoreOperators.in,
    });
    return this;
  }

  whereNotIn(prop: IWherePropParam<T>, val: IFirestoreVal[]) {
    if (val.length > 10) {
      throw new Error(`
        This query supports up to 10 values. You provided ${val.length}.
        For details please visit: https://firebase.google.com/docs/firestore/query-data/queries#in_not-in_and_array-contains-any
      `);
    }
    this.queries.push({
      prop: this.extractWhereParam(prop),
      val,
      operator: FirestoreOperators.notIn,
    });
    return this;
  }

  limit(limitVal: number) {
    if (this.limitVal) {
      throw new Error(
        'A limit function cannot be called more than once in the same query expression'
      );
    }
    this.limitVal = limitVal;
    return this;
  }

  offset(offsetVal: number) {
    if (this.offsetVal) {
      throw new Error(
        'A limit function cannot be called more than once in the same query expression'
      );
    }
    this.offsetVal = offsetVal;
    return this;
  }

  startAt(...startAtVal: any[]) {
    if (this.startAtVal || this.startAfterVal) {
      throw new Error(
        'A startAt function cannot be called more than once in the same query expression'
      );
    }
    this.startAtVal = startAtVal;
    return this;
  }

  startAfter(...startAfterVal: any[]) {
    if (this.startAtVal || this.startAfterVal) {
      throw new Error(
        'A startAt function cannot be called more than once in the same query expression'
      );
    }
    this.startAfterVal = startAfterVal;
    return this;
  }

  endAt(...endAtVal: any[]) {
    if (this.endAtVal || this.endBeforeVal) {
      throw new Error(
        'A endAt function cannot be called more than once in the same query expression'
      );
    }
    this.endAtVal = endAtVal;
    return this;
  }

  endBefore(...endBeforeVal: any[]) {
    if (this.endAtVal || this.endBeforeVal) {
      throw new Error(
        'A endAt function cannot be called more than once in the same query expression'
      );
    }
    this.endBeforeVal = endBeforeVal;
    return this;
  }

  orderByAscending(prop: IWherePropParam<T>) {
    const fieldProp: string = typeof prop == 'string' ? prop : '';
    const alreadyOrderedByField = this.orderByFields.has(fieldProp);

    if (this.orderByObj && alreadyOrderedByField) {
      throw new Error(
        'An orderBy function cannot be called more than once in the same query expression'
      );
    }

    if (!alreadyOrderedByField && fieldProp) {
      this.orderByFields.add(fieldProp);
    }

    this.orderByObj = {
      fieldPath: this.extractWhereParam(prop),
      directionStr: 'asc',
    };

    return this;
  }

  orderByDescending(prop: IWherePropParam<T>) {
    const fieldProp: string = typeof prop == 'string' ? prop : '';
    const alreadyOrderedByField = this.orderByFields.has(fieldProp);

    if (this.orderByObj && alreadyOrderedByField) {
      throw new Error(
        'An orderBy function cannot be called more than once in the same query expression'
      );
    }

    if (!alreadyOrderedByField && fieldProp) {
      this.orderByFields.add(fieldProp);
    }

    this.orderByObj = {
      fieldPath: this.extractWhereParam(prop),
      directionStr: 'desc',
    };

    return this;
  }

  find() {
    return this.executor.execute(
      this.queries,
      this.limitVal,
      this.orderByObj,
      false,
      this.customQueryFunction,
      this.offsetVal,
      this.createCursor()
    );
  }

  customQuery(func: ICustomQuery<T>) {
    if (this.customQueryFunction) {
      throw new Error('Only one custom query can be used per query expression');
    }

    this.customQueryFunction = func;

    return this;
  }

  async findOne() {
    const queryResult = await this.executor.execute(
      this.queries,
      this.limitVal,
      this.orderByObj,
      true,
      this.customQueryFunction
    );

    return queryResult.length ? queryResult[0] : null;
  }

  async count() {
    return this.executor.executeCount(this.queries, this.customQueryFunction);
  }
}
