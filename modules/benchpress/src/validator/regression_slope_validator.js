import { List, ListWrapper } from 'angular2/src/facade/collection';
import { bind, OpaqueToken } from 'angular2/di';

import { Validator } from '../validator';
import { Statistic } from '../statistic';

import {Binding} from 'angular2/di';
export {Binding} from 'angular2/di';

/**
 * A validator that checks the regression slope of a specific metric.
 * Waits for the regression slope to be >=0.
 */
export class RegressionSlopeValidator extends Validator {
  // TODO(tbosch): use static values when our transpiler supports them
  static get SAMPLE_SIZE() { return _SAMPLE_SIZE; }
  // TODO(tbosch): use static values when our transpiler supports them
  static get METRIC() { return _METRIC; }
  // TODO(tbosch): use static values when our transpiler supports them
  static get BINDINGS() { return _BINDINGS; }

  _sampleSize:number;
  _metric:string;

  constructor(sampleSize, metric) {
    super();
    this._sampleSize = sampleSize;
    this._metric = metric;
  }

  describe():any {
    return {
      'sampleSize': this._sampleSize,
      'regressionSlopeMetric': this._metric
    };
  }

  validate(completeSample:List<any>):List<any> {
    if (completeSample.length >= this._sampleSize) {
      var latestSample =
        ListWrapper.slice(completeSample, completeSample.length - this._sampleSize, completeSample.length);
      var xValues = [];
      var yValues = [];
      for (var i = 0; i<latestSample.length; i++) {
        // For now, we only use the array index as x value.
        // TODO(tbosch): think about whether we should use time here instead
        ListWrapper.push(xValues, i);
        ListWrapper.push(yValues, latestSample[i][this._metric]);
      }
      var regressionSlope = Statistic.calculateRegressionSlope(
        xValues, Statistic.calculateMean(xValues),
        yValues, Statistic.calculateMean(yValues)
      );
      return regressionSlope >= 0 ? latestSample : null;
    } else {
      return null;
    }
  }

}

var _SAMPLE_SIZE = new OpaqueToken('RegressionSlopeValidator.sampleSize');
var _METRIC = new OpaqueToken('RegressionSlopeValidator.metric');
var _BINDINGS = [
  bind(Validator).toFactory(
    (sampleSize, metric) => new RegressionSlopeValidator(sampleSize, metric),
    [_SAMPLE_SIZE, _METRIC]
  ),
  bind(_SAMPLE_SIZE).toValue(10),
  bind(_METRIC).toValue('script')
];
