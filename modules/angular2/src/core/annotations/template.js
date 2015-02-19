import {ABSTRACT, CONST, Type, addAnnotation} from 'angular2/src/facade/lang';
import {List} from 'angular2/src/facade/collection';

export class TemplateAnnotation {
  url:any; //string;
  inline:any; //string;
  directives:any; //List<Type>;
  formatters:any; //List<Type>;
  source:any;//List<Template>;
  locale:any; //string
  device:any; //string
  @CONST()
  constructor({
      url,
      inline,
      directives,
      formatters,
      source,
      locale,
      device
    }: any) {

  //constructor( {
  //    url,
  //    inline,
  //    directives,
  //    formatters,
  //    source,
  //    locale,
  //    device
  //}: {
		//  url?: string,
		//  inline?: string,
		//  directives?: List<Type>,
		//  formatters?: List<Type>,
		//  source?: List<Template>,
		//  locale?: string,
		//  device?: string
	 // })
    this.url = url;
    this.inline = inline;
    this.directives = directives;
    this.formatters = formatters;
    this.source = source;
    this.locale = locale;
    this.device = device;
  }
}

export function Template(arg) {
    return c => addAnnotation(c, new TemplateAnnotation(arg));
}