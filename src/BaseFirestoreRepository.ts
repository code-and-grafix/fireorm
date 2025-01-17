import 'reflect-metadata';

import { DocumentReference, Query, WhereFilterOp } from '@google-cloud/firestore';

import {
  IRepository,
  IFireOrmQueryLine,
  IOrderByParams,
  IEntity,
  PartialBy,
  ITransactionRepository,
  ICustomQuery,
  IQueryCursor,
} from './types';

import { getMetadataStorage } from './MetadataUtils';
import { AbstractFirestoreRepository } from './AbstractFirestoreRepository';
import { FirestoreBatch } from './Batch/FirestoreBatch';

export class BaseFirestoreRepository<T extends IEntity>
  extends AbstractFirestoreRepository<T>
  implements IRepository<T>
{
  async findById(id: string) {
    return this.firestoreColRef
      .doc(id)
      .get()
      .then(d => (d.exists ? this.extractTFromDocSnap(d) : null));
  }

  async create(item: PartialBy<T, 'id'>, userRef?: DocumentReference): Promise<T> {
    if (this.config.validateModels) {
      const errors = await this.validate(item as T);

      if (errors.length) {
        throw errors;
      }
    }

    if (item.id) {
      const found = await this.findById(item.id);
      if (found) {
        throw new Error(`A document with id ${item.id} already exists.`);
      }
    }

    const doc = item.id ? this.firestoreColRef.doc(item.id) : this.firestoreColRef.doc();

    if (!item.id) {
      item.id = doc.id;
    }

    if (userRef) {
      (item as any).createdBy = userRef;
      (item as any).createdAt = new Date();
    }

    item = this.transformFirestoreTypesBeforeSave(item);
    await doc.set(this.toSerializableObject(item as T));

    this.initializeSubCollections(item as T);

    return item as T;
  }

  async update(item: T, userRef?: DocumentReference) {
    if (this.config.validateModels) {
      const errors = await this.validate(item);

      if (errors.length) {
        throw errors;
      }
    }

    // do not update audit fields
    delete (item as any).createdAt;
    delete (item as any).createdBy;
    delete (item as any).modifiedBy;
    delete (item as any).modifiedAt;

    if (userRef) {
      (item as any).modifiedBy = userRef;
      (item as any).modifiedAt = new Date();
    }

    // TODO: handle errors
    item = this.transformFirestoreTypesBeforeSave(item as Record<string, unknown>);
    await this.firestoreColRef.doc(item.id).update(this.toSerializableObject(item));
    return item;
  }

  async delete(id: string): Promise<void> {
    // TODO: handle errors
    await this.firestoreColRef.doc(id).delete();
  }

  async count(): Promise<number> {
    return this.firestoreColRef
      .count()
      .get()
      .then(c => c.data().count);
  }

  async runTransaction<R>(executor: (tran: ITransactionRepository<T>) => Promise<R>) {
    // Importing here to prevent circular dependency
    const { runTransaction } = await import('./helpers');

    return runTransaction<R>(tran => {
      const repository = tran.getRepository<T>(this.path);
      return executor(repository);
    });
  }

  createBatch() {
    const { firestoreRef } = getMetadataStorage();
    return new FirestoreBatch(firestoreRef).getSingleRepository(this.path);
  }

  async execute(
    queries: Array<IFireOrmQueryLine>,
    limitVal?: number,
    orderByObj?: IOrderByParams,
    single?: boolean,
    customQuery?: ICustomQuery<T>,
    offsetVal?: number,
    cursor?: IQueryCursor
  ): Promise<T[]> {
    let query = queries.reduce<Query>((acc, cur) => {
      const op = cur.operator as WhereFilterOp;
      return acc.where(cur.prop, op, cur.val);
    }, this.firestoreColRef);

    if (orderByObj) {
      query = query.orderBy(orderByObj.fieldPath, orderByObj.directionStr);
    }

    if (cursor?.startAt) {
      query = query.startAt(...cursor?.startAt);
    }

    if (cursor?.startAfter) {
      query = query.startAfter(...cursor?.startAfter);
    }

    if (cursor?.endAt) {
      query = query.endAt(...cursor?.endAt);
    }

    if (cursor?.endBefore) {
      query = query.endBefore(...cursor?.endBefore);
    }

    if (offsetVal) {
      query = query.offset(offsetVal);
    }

    if (single) {
      query = query.limit(1);
    } else if (limitVal) {
      query = query.limit(limitVal);
    }

    if (customQuery) {
      query = await customQuery(query, this.firestoreColRef);
    }

    return query.get().then(this.extractTFromColSnap);
  }

  async executeCount(
    queries: Array<IFireOrmQueryLine>,
    customQuery?: ICustomQuery<T>
  ): Promise<number> {
    let query = queries.reduce<Query>((acc, cur) => {
      const op = cur.operator as WhereFilterOp;
      return acc.where(cur.prop, op, cur.val);
    }, this.firestoreColRef);

    if (customQuery) {
      query = await customQuery(query, this.firestoreColRef);
    }

    return query
      .count()
      .get()
      .then(doc => doc.data().count ?? 0);
  }
}
