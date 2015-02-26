import {FIELD, isBlank, isPresent, FunctionWrapper, BaseException} from "angular2/src/facade/lang";
import {List, Map, ListWrapper, StringMapWrapper} from "angular2/src/facade/collection";
import {ContextWithVariableBindings} from "./context_with_variable_bindings";

export class AST {
  eval(context): any {
    throw new BaseException("Not supported");
  }

  get isAssignable() {
    return false;
  }

  assign(context, value) {
    throw new BaseException("Not supported");
  }

  visit(visitor) {
  }

  toString():string {
    return "AST";
  }
}

export class EmptyExpr extends AST {
  eval(context): any {
    return null;
  }

  visit(visitor) {
    //do nothing
  }
}

export class ImplicitReceiver extends AST {
  eval(context): any {
    return context;
  }

  visit(visitor) {
    return visitor.visitImplicitReceiver(this);
  }
}

/**
 * Multiple expressions separated by a semicolon.
 */
export class Chain extends AST {
  expressions:List<any>;
  constructor(expressions:List<any>) {
    super();
    this.expressions = expressions;
  }

  eval(context): any {
    var result;
    for (var i = 0; i < this.expressions.length; i++) {
      var last = this.expressions[i].eval(context);
      if (isPresent(last)) result = last;
    }
    return result;
  }

  visit(visitor) {
    return visitor.visitChain(this);
  }
}

export class Conditional extends AST {
  condition:AST;
  trueExp:AST;
  falseExp:AST;
  constructor(condition:AST, trueExp:AST, falseExp:AST){
    super();
    this.condition = condition;
    this.trueExp = trueExp;
    this.falseExp = falseExp;
  }

  eval(context): any {
    if(this.condition.eval(context)) {
      return this.trueExp.eval(context);
    } else {
      return this.falseExp.eval(context);
    }
  }

  visit(visitor) {
    return visitor.visitConditional(this);
  }
}

export class AccessMember extends AST {
  receiver:AST;
  name:string;
  getter:Function;
  setter:Function;
  constructor(receiver:AST, name:string, getter:Function, setter:Function) {
    super();
    this.receiver = receiver;
    this.name = name;
    this.getter = getter;
    this.setter = setter;
  }

  eval(context): any {
    var evaluatedContext = this.receiver.eval(context);

    while (evaluatedContext instanceof ContextWithVariableBindings) {
      if (evaluatedContext.hasBinding(this.name)) {
        return evaluatedContext.get(this.name);
      }
      evaluatedContext = evaluatedContext.parent;
    }

    return this.getter(evaluatedContext);
  }

  get isAssignable() {
    return true;
  }

  assign(context, value) {
    var evaluatedContext = this.receiver.eval(context);

    while (evaluatedContext instanceof ContextWithVariableBindings) {
      if (evaluatedContext.hasBinding(this.name)) {
        throw new BaseException(`Cannot reassign a variable binding ${this.name}`)
      }
      evaluatedContext = evaluatedContext.parent;
    }

    return this.setter(evaluatedContext, value);
  }

  visit(visitor) {
    return visitor.visitAccessMember(this);
  }
}

export class KeyedAccess extends AST {
  obj:AST;
  key:AST;
  constructor(obj:AST, key:AST) {
    super();
    this.obj = obj;
    this.key = key;
  }

  eval(context): any {
    var obj = this.obj.eval(context);
    var key = this.key.eval(context);
    return obj[key];
  }

  get isAssignable() {
    return true;
  }

  assign(context, value) {
    var obj = this.obj.eval(context);
    var key = this.key.eval(context);
    obj[key] = value;
    return value;
  }

  visit(visitor) {
    return visitor.visitKeyedAccess(this);
  }
}

export class Pipe extends AST {
  exp:AST;
  name:string;
  args:List<AST>;
  constructor(exp:AST, name:string, args:List<any>) {
    super();
    this.exp = exp;
    this.name = name;
    this.args = args;
  }

  visit(visitor) {
    return visitor.visitPipe(this);
  }
}

export class LiteralPrimitive extends AST {
  value;
  constructor(value) {
    super();
    this.value = value;
  }

  eval(context): any {
    return this.value;
  }

  visit(visitor) {
    return visitor.visitLiteralPrimitive(this);
  }
}

export class LiteralArray extends AST {
  expressions:List<any>;
  constructor(expressions:List<any>) {
    super();
    this.expressions = expressions;
  }

  eval(context): any {
    return ListWrapper.map(this.expressions, (e) => e.eval(context));
  }

  visit(visitor) {
    return visitor.visitLiteralArray(this);
  }
}

export class LiteralMap extends AST {
  keys:List<any>;
  values:List<any>;
  constructor(keys:List<any>, values:List<any>) {
    super();
    this.keys = keys;
    this.values = values;
  }

  eval(context): any {
    var res = StringMapWrapper.create();
    for(var i = 0; i < this.keys.length; ++i) {
      StringMapWrapper.set(res, this.keys[i], this.values[i].eval(context));
    }
    return res;
  }

  visit(visitor) {
    return visitor.visitLiteralMap(this);
  }
}

export class Interpolation extends AST {
  strings:List<any>;
  expressions:List<any>;
  constructor(strings:List<any>, expressions:List<any>) {
    super();
    this.strings = strings;
    this.expressions = expressions;
  }

  eval(context): any {
    throw new BaseException("evaluating an Interpolation is not supported");
  }

  visit(visitor) {
    visitor.visitInterpolation(this);
  }
}

export class Binary extends AST {
  operation:string;
  left:AST;
  right:AST;
  constructor(operation:string, left:AST, right:AST) {
    super();
    this.operation = operation;
    this.left = left;
    this.right = right;
  }

  eval(context): any {
    var left = this.left.eval(context);
    switch (this.operation) {
      case '&&': return left && this.right.eval(context);
      case '||': return left || this.right.eval(context);
    }
    var right = this.right.eval(context);

    switch (this.operation) {
      case '+'  : return left + right;
      case '-'  : return left - right;
      case '*'  : return left * right;
      case '/'  : return left / right;
      case '%'  : return left % right;
      case '==' : return left == right;
      case '!=' : return left != right;
      case '<'  : return left < right;
      case '>'  : return left > right;
      case '<=' : return left <= right;
      case '>=' : return left >= right;
      case '^'  : return left ^ right;
      case '&'  : return left & right;
    }
    throw 'Internal error [$operation] not handled';
  }

  visit(visitor) {
    return visitor.visitBinary(this);
  }
}

export class PrefixNot extends AST {
  expression:AST;
  constructor(expression:AST) {
    super();
    this.expression = expression;
  }

  eval(context): any {
    return !this.expression.eval(context);
  }

  visit(visitor) {
    return visitor.visitPrefixNot(this);
  }
}

export class Assignment extends AST {
  target:AST;
  value:AST;
  constructor(target:AST, value:AST) {
    super();
    this.target = target;
    this.value = value;
  }

  eval(context): any {
    return this.target.assign(context, this.value.eval(context));
  }

  visit(visitor) {
    return visitor.visitAssignment(this);
  }
}

export class MethodCall extends AST {
  receiver:AST;
  fn:Function;
  args:List<any>;
  name:string;
  constructor(receiver:AST, name:string, fn:Function, args:List<any>) {
    super();
    this.receiver = receiver;
    this.fn = fn;
    this.args = args;
    this.name = name;
  }

  eval(context): any {
    var evaluatedContext = this.receiver.eval(context);
    var evaluatedArgs = evalList(context, this.args);

    while (evaluatedContext instanceof ContextWithVariableBindings) {
      if (evaluatedContext.hasBinding(this.name)) {
        var fn = evaluatedContext.get(this.name);
        return FunctionWrapper.apply(fn, evaluatedArgs);
      }
      evaluatedContext = evaluatedContext.parent;
    }

    return this.fn(evaluatedContext, evaluatedArgs);
  }

  visit(visitor) {
    return visitor.visitMethodCall(this);
  }
}

export class FunctionCall extends AST {
  target:AST;
  args:List<any>;
  constructor(target:AST, args:List<any>) {
    super();
    this.target = target;
    this.args = args;
  }

  eval(context): any {
    var obj = this.target.eval(context);
    if (! (obj instanceof Function)) {
      throw new BaseException(`${obj} is not a function`);
    }
    return FunctionWrapper.apply(obj, evalList(context, this.args));
  }

  visit(visitor) {
    return visitor.visitFunctionCall(this);
  }
}

export class ASTWithSource extends AST {
  ast:AST;
  source:string;
  location:string;
  constructor(ast:AST, source:string, location:string) {
    super();
    this.source = source;
    this.location = location;
    this.ast = ast;
  }

  eval(context): any {
    return this.ast.eval(context);
  }

  get isAssignable() {
    return this.ast.isAssignable;
  }

  assign(context, value) {
    return this.ast.assign(context, value);
  }

  visit(visitor) {
    return this.ast.visit(visitor);
  }

  toString():string {
    return `${this.source} in ${this.location}`;
  }
}

export class TemplateBinding {
  key:string;
  keyIsVar:boolean;
  name:string;
  expression:ASTWithSource;
  constructor(key:string, keyIsVar:boolean, name:string, expression:ASTWithSource) {
    this.key = key;
    this.keyIsVar = keyIsVar;
    // only either name or expression will be filled.
    this.name = name;
    this.expression = expression;
  }
}

//INTERFACE
export class AstVisitor {
  visitAccessMember(ast:AccessMember) {}
  visitAssignment(ast:Assignment) {}
  visitBinary(ast:Binary) {}
  visitChain(ast:Chain){}
  visitConditional(ast:Conditional) {}
  visitPipe(ast:Pipe) {}
  visitFunctionCall(ast:FunctionCall) {}
  visitImplicitReceiver(ast:ImplicitReceiver) {}
  visitKeyedAccess(ast:KeyedAccess) {}
  visitLiteralArray(ast:LiteralArray) {}
  visitLiteralMap(ast:LiteralMap) {}
  visitLiteralPrimitive(ast:LiteralPrimitive) {}
  visitMethodCall(ast:MethodCall) {}
  visitPrefixNot(ast:PrefixNot) {}
}

var _evalListCache = [[],[0],[0,0],[0,0,0],[0,0,0,0],[0,0,0,0,0]];
function evalList(context, exps:List<any>){
  var length = exps.length;
  var result = _evalListCache[length];
  for (var i = 0; i < length; i++) {
    result[i] = exps[i].eval(context);
  }
  return result;
}
