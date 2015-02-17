import { isPresent, isBlank } from 'angular2/src/facade/lang';
import { Promise, PromiseWrapper } from 'angular2/src/facade/async';
import { StringMapWrapper, List, ListWrapper } from 'angular2/src/facade/collection';
import { bind, OpaqueToken } from 'angular2/di';

import { Metric } from './metric';
import { Validator } from './validator';
import { Reporter } from './reporter';
import { WebDriverExtension } from './web_driver_extension';
import { WebDriverAdapter } from './web_driver_adapter';

import { Options } from './sample_options';

/**
 * The Sampler owns the sample loop:
 * 1. calls the prepare/execute callbacks,
 * 2. gets data from the metric
 * 3. asks the validator for a valid sample
 * 4. reports the new data to the reporter
 * 5. loop until there is a valid sample
 */
export class Sampler {
  // TODO(tbosch): use static values when our transpiler supports them
  static get BINDINGS() { return _BINDINGS; }

  _driver:WebDriverAdapter;
  _driverExtension:WebDriverExtension;
  _metric:Metric;
  _reporter:Reporter;
  _validator:Validator;
  _forceGc:boolean;
  _prepare:Function;
  _execute:Function;

  constructor({
    driver, driverExtension, metric, reporter, validator, forceGc, prepare, execute
  }:{
    driver: WebDriverAdapter,
    driverExtension: WebDriverExtension, metric: Metric, reporter: Reporter,
    validator: Validator, prepare: Function, execute: Function
  }={}) {
    this._driver = driver;
    this._driverExtension = driverExtension;
    this._metric = metric;
    this._reporter = reporter;
    this._validator = validator;
    this._forceGc = forceGc;
    this._prepare = prepare;
    this._execute = execute;
  }

  sample():Promise<SampleState> {
    var loop;
    loop = (lastState) => {
      return this._iterate(lastState)
        .then( (newState) => {
          if (isPresent(newState.validSample)) {
            return newState;
          } else {
            return loop(newState);
          }
        });
    }
    return this._gcIfNeeded().then( (_) => loop(new SampleState([], null)) );
  }

  _gcIfNeeded() {
    if (this._forceGc) {
      return this._driverExtension.gc();
    } else {
      return PromiseWrapper.resolve(null);
    }
  }

  _iterate(lastState) {
    var resultPromise;
    if (isPresent(this._prepare)) {
      resultPromise = this._driver.waitFor(this._prepare)
        .then( (_) => this._gcIfNeeded() );
    } else {
      resultPromise = PromiseWrapper.resolve(null);
    }
    if (isPresent(this._prepare) || lastState.completeSample.length === 0) {
      resultPromise = resultPromise.then( (_) => this._metric.beginMeasure() );
    }
    return resultPromise
      .then( (_) => this._driver.waitFor(this._execute) )
      .then( (_) => this._gcIfNeeded() )
      .then( (_) => this._metric.endMeasure(isBlank(this._prepare)) )
      .then( (measureValues) => this._report(lastState, measureValues) );
  }

  _report(state:SampleState, measuredValues:any):Promise<SampleState> {
    var completeSample = ListWrapper.concat(state.completeSample, [measuredValues]);
    var validSample = this._validator.validate(completeSample);
    var resultPromise = this._reporter.reportMeasureValues(completeSample.length - 1, measuredValues);
    if (isPresent(validSample)) {
      resultPromise = resultPromise.then( (_) => this._reporter.reportSample(completeSample, validSample) )
    }
    return resultPromise.then( (_) => new SampleState(completeSample, validSample) );
  }

}

export class SampleState {
  completeSample:List<any>;
  validSample:List<any>;

  constructor(completeSample: List<any>, validSample: List<any>) {
    this.completeSample = completeSample;
    this.validSample = validSample;
  }
}

var _BINDINGS = [
  bind(Sampler).toFactory(
    (driver, driverExtension, metric, reporter, validator, forceGc, prepare, execute) => new Sampler({
      driver: driver,
      driverExtension: driverExtension,
      reporter: reporter,
      validator: validator,
      metric: metric,
      forceGc: forceGc,
      // TODO(tbosch): DI right now does not support null/undefined objects
      // Mostly because the cache would have to be initialized with a
      // special null object, which is expensive.
      prepare: prepare !== false ? prepare : null,
      execute: execute
    }),
    [WebDriverAdapter, WebDriverExtension, Metric, Reporter, Validator, Options.FORCE_GC, Options.PREPARE, Options.EXECUTE]
  ),
  bind(Options.FORCE_GC).toValue(false),
  bind(Options.PREPARE).toValue(false)
];
