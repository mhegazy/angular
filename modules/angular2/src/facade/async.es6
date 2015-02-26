import {int, global} from 'angular2/src/facade/lang';
import {List} from 'angular2/src/facade/collection';

export var Promise = global.Promise;

export class PromiseWrapper {
  //static resolve<T>(obj:T):Promise<T> {
  static resolve(obj:any):Promise<any> {
    return Promise.resolve(obj);
  }

  //static reject<T>(obj:T):Promise<T> {
  static reject(obj:any):Promise<any> {
    return Promise.reject(obj);
  }

  // Note: We can't rename this method into `catch`, as this is not a valid
  // method name in Dart.
  //static catchError<T>(promise:Promise<T>, onError:Function):Promise<T> {
  static catchError(promise:Promise<any>, onError:Function):Promise<any> {
    return promise.catch(onError);
  }

  //static all<T>(promises:List<Promise<T>>):Promise<T[]> {
  static all(promises:List<any>):Promise<any> {
    if (promises.length == 0) return Promise.resolve([]);
    return Promise.all(promises);
  }

  //static then<TResult>(promise: Promise<TResult>, success: (value: any) => TResult | Promise<TResult>, rejection: (reason: any) => TResult | Promise<TResult>): Promise<TResult> {
  static then(promise: Promise<any>, success: Function, rejection: Function): Promise<any> {
    return promise.then(success, rejection);
  }

  static completer() {
    var resolve;
    var reject;

    var p = new Promise(function(res, rej) {
      resolve = res;
      reject = rej;
    });

    return {
      promise: p,
      resolve: resolve,
      reject: reject
    };
  }

  static setTimeout(fn:Function, millis:int) {
    global.setTimeout(fn, millis);
  }

  static isPromise(maybePromise):boolean {
    return maybePromise instanceof Promise;
  }
}
