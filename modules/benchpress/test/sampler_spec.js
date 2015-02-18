import {describe, it, iit, xit, expect, beforeEach, afterEach} from 'angular2/test_lib';

import { isBlank, isPresent, BaseException, stringify } from 'angular2/src/facade/lang';
import { ListWrapper, List } from 'angular2/src/facade/collection';
import { PromiseWrapper, Promise } from 'angular2/src/facade/async';

import {
  Sampler, WebDriverAdapter, WebDriverExtension,
  Validator, Metric, Reporter,
  bind, Injector, Options
} from 'benchpress/benchpress';

export function main() {
  var EMPTY_EXECUTE = () => {};

  describe('sampler', () => {
    var sampler;

    function createSampler({
      driver,
      driverExtension,
      metric,
      reporter,
      validator,
      forceGc,
      prepare,
      execute
    }) {
      if (isBlank(metric)) {
        metric = new MockMetric([]);
      }
      if (isBlank(reporter)) {
        reporter = new MockReporter([]);
      }
      if (isBlank(driver)) {
        driver = new MockDriverAdapter([]);
      }
      if (isBlank(driverExtension)) {
        driverExtension = new MockDriverExtension([]);
      }
      var bindings = ListWrapper.concat(Sampler.BINDINGS, [
        bind(Metric).toValue(metric),
        bind(Reporter).toValue(reporter),
        bind(WebDriverAdapter).toValue(driver),
        bind(WebDriverExtension).toValue(driverExtension),
        bind(Options.EXECUTE).toValue(execute),
        bind(Validator).toValue(validator)
      ]);
      if (isPresent(prepare)) {
        ListWrapper.push(bindings, bind(Options.PREPARE).toValue(prepare));
      }
      if (isPresent(forceGc)) {
        ListWrapper.push(bindings, bind(Options.FORCE_GC).toValue(forceGc));
      }

      sampler = new Injector(bindings).get(Sampler);
    }

    it('should call the prepare and execute callbacks using WebDriverAdapter.waitFor', (done) => {
      var log = [];
      var count = 0;
      var driver = new MockDriverAdapter([], (callback) => {
        var result = callback();
        ListWrapper.push(log, result);
        return PromiseWrapper.resolve(result);
      });
      createSampler({
        driver: driver,
        validator: createCountingValidator(2),
        prepare: () => {
          return count++;
        },
        execute: () => {
          return count++;
        }
      });
      sampler.sample().then( (_) => {
        expect(count).toBe(4);
        expect(log).toEqual([0,1,2,3]);
        done();
      });

    });

    it('should call prepare, gc, beginMeasure, execute, gc, endMeasure for every iteration', (done) => {
      var workCount = 0;
      var log = [];
      createSampler({
        forceGc: true,
        metric: createCountingMetric(log),
        driverExtension: new MockDriverExtension(log),
        validator: createCountingValidator(2),
        prepare: () => {
          ListWrapper.push(log, `p${workCount++}`);
        },
        execute: () => {
          ListWrapper.push(log, `w${workCount++}`);
        }
      });
      sampler.sample().then( (_) => {
        expect(log).toEqual([
          ['gc'],
          'p0',
          ['gc'],
          ['beginMeasure'],
          'w1',
          ['gc'],
          ['endMeasure', false, {'script': 0}],
          'p2',
          ['gc'],
          ['beginMeasure'],
          'w3',
          ['gc'],
          ['endMeasure', false, {'script': 1}],
        ]);
        done();
      });
    });

    it('should call execute, gc, endMeasure for every iteration if there is no prepare callback', (done) => {
      var log = [];
      var workCount = 0;
      createSampler({
        forceGc: true,
        metric: createCountingMetric(log),
        driverExtension: new MockDriverExtension(log),
        validator: createCountingValidator(2),
        execute: () => {
          ListWrapper.push(log, `w${workCount++}`);
        },
        prepare: null
      });
      sampler.sample().then( (_) => {
        expect(log).toEqual([
          ['gc'],
          ['beginMeasure'],
          'w0',
          ['gc'],
          ['endMeasure', true, {'script': 0}],
          'w1',
          ['gc'],
          ['endMeasure', true, {'script': 1}],
        ]);
        done();
      });
    });

    it('should not gc if the flag is not set', (done) => {
      var workCount = 0;
      var log = [];
      createSampler({
        metric: createCountingMetric(),
        driverExtension: new MockDriverExtension(log),
        validator: createCountingValidator(2),
        prepare: EMPTY_EXECUTE,
        execute: EMPTY_EXECUTE
      });
      sampler.sample().then( (_) => {
        expect(log).toEqual([]);
        done();
      });
    });

    it('should only collect metrics for execute and ignore metrics from prepare', (done) => {
      var scriptTime = 0;
      var iterationCount = 1;
      createSampler({
        validator: createCountingValidator(2),
        metric: new MockMetric([], () => {
          var result = PromiseWrapper.resolve({'script': scriptTime});
          scriptTime = 0;
          return result;
        }),
        prepare: () => {
          scriptTime = 1 * iterationCount;
        },
        execute: () => {
          scriptTime = 10 * iterationCount;
          iterationCount++;
        }
      });
      sampler.sample().then( (state) => {
        expect(state.completeSample.length).toBe(2);
        expect(state.completeSample[0]).toEqual({'script': 10});
        expect(state.completeSample[1]).toEqual({'script': 20});
        done();
      });
    });

    it('should call the validator for every execution and store the valid sample', (done) => {
      var log = [];
      var validSample = [{}];

      createSampler({
        metric: createCountingMetric(),
        validator: createCountingValidator(2, validSample, log),
        execute: EMPTY_EXECUTE
      });
      sampler.sample().then( (state) => {
        expect(state.validSample).toBe(validSample);
        // TODO(tbosch): Why does this fail??
        // expect(log).toEqual([
        //   ['validate', [{'script': 0}], null],
        //   ['validate', [{'script': 0}, {'script': 1}], validSample]
        // ]);

        expect(log.length).toBe(2);
        expect(log[0]).toEqual(
          ['validate', [{'script': 0}], null]
        );
        expect(log[1]).toEqual(
          ['validate', [{'script': 0}, {'script': 1}], validSample]
        );

        done();
      });
    });

    it('should report the metric values', (done) => {
      var log = [];
      var validSample = [{}];
      createSampler({
        validator: createCountingValidator(2, validSample),
        metric: createCountingMetric(),
        reporter: new MockReporter(log),
        execute: EMPTY_EXECUTE
      });
      sampler.sample().then( (_) => {
        // TODO(tbosch): Why does this fail??
        // expect(log).toEqual([
        //   ['reportMeasureValues', 0, {'script': 0}],
        //   ['reportMeasureValues', 1, {'script': 1}],
        //   ['reportSample', [{'script': 0}, {'script': 1}], validSample]
        // ]);
        expect(log.length).toBe(3);
        expect(log[0]).toEqual(
          ['reportMeasureValues', 0, {'script': 0}]
        );
        expect(log[1]).toEqual(
          ['reportMeasureValues', 1, {'script': 1}]
        );
        expect(log[2]).toEqual(
          ['reportSample', [{'script': 0}, {'script': 1}], validSample]
        );

        done();
      });
    });

  });
}

function createCountingValidator(count, validSample = null, log = null) {
  return new MockValidator(log, (completeSample) => {
    count--;
    if (count === 0) {
      return isPresent(validSample) ? validSample : completeSample;
    } else {
      return null;
    }
  });
}

function createCountingMetric(log = null) {
  var scriptTime = 0;
  return new MockMetric(log, () => {
    return { 'script': scriptTime++ };
  });
}

class MockDriverAdapter extends WebDriverAdapter {
  _log:List<any>;
  _waitFor:Function;
  constructor(log = null, waitFor = null) {
    super();
    if (isBlank(log)) {
      log = [];
    }
    this._log = log;
    this._waitFor = waitFor;
  }
  waitFor(callback:Function):Promise<any> {
    if (isPresent(this._waitFor)) {
      return this._waitFor(callback);
    } else {
      return PromiseWrapper.resolve(callback());
    }
  }
}


class MockDriverExtension extends WebDriverExtension {
  _log:List<any>;
  constructor(log = null) {
    super();
    if (isBlank(log)) {
      log = [];
    }
    this._log = log;
  }
  gc():Promise<any> {
    ListWrapper.push(this._log, ['gc']);
    return PromiseWrapper.resolve(null);
  }
}

class MockValidator extends Validator {
  _validate:Function;
  _log:List<any>;
  constructor(log = null, validate = null) {
    super();
    this._validate = validate;
    if (isBlank(log)) {
      log = [];
    }
    this._log = log;
  }
  validate(completeSample:List<Object>):List<Object> {
    var stableSample = isPresent(this._validate) ? this._validate(completeSample) : completeSample;
    ListWrapper.push(this._log, ['validate', completeSample, stableSample]);
    return stableSample;
  }
}

class MockMetric extends Metric {
  _endMeasure:Function;
  _log:List<any>;
  constructor(log = null, endMeasure = null) {
    super();
    this._endMeasure = endMeasure;
    if (isBlank(log)) {
      log = [];
    }
    this._log = log;
  }
  beginMeasure() {
    ListWrapper.push(this._log, ['beginMeasure']);
    return PromiseWrapper.resolve(null);
  }
  endMeasure(restart) {
    var measureValues = isPresent(this._endMeasure) ? this._endMeasure() : {};
    ListWrapper.push(this._log, ['endMeasure', restart, measureValues]);
    return PromiseWrapper.resolve(measureValues);
  }
}

class MockReporter extends Reporter {
  _log:List<any>;
  constructor(log = null) {
    super();
    if (isBlank(log)) {
      log = [];
    }
    this._log = log;
  }
  reportMeasureValues(index, values):Promise<any> {
    ListWrapper.push(this._log, ['reportMeasureValues', index, values]);
    return PromiseWrapper.resolve(null);
  }
  reportSample(completeSample, validSample):Promise<any> {
    ListWrapper.push(this._log, ['reportSample', completeSample, validSample]);
    return PromiseWrapper.resolve(null);
  }
}