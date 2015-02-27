import {Map, MapWrapper, ListWrapper} from 'angular2/src/facade/collection';
import {Type, isPresent} from 'angular2/src/facade/lang';

import {TemplateAnnotation} from 'angular2/src/core/annotations/template';
import {TemplateResolver} from 'angular2/src/core/compiler/template_resolver';

export class MockTemplateResolver extends TemplateResolver {
  _cmpTemplates: Map<any,any>;

  constructor() {
    super();
    this._cmpTemplates = MapWrapper.create();
  }

  setTemplate(component: Type, template: TemplateAnnotation) {
    MapWrapper.set(this._cmpTemplates, component, template);
  }

  resolve(component: Type): TemplateAnnotation {
    var override = MapWrapper.get(this._cmpTemplates, component);

    if (isPresent(override)) {
      return override;
    }

    return super.resolve(component);
  }
}
