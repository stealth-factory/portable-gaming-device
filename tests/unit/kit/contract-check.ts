import ts from 'typescript';

/** The drawing surface frozen by disk contract v1, rather than whichever Canvas a host supplies. */
export const SCREEN_MEMBERS = [
  'fillStyle', 'fillRect', 'beginPath', 'rect', 'moveTo', 'lineTo', 'arc', 'arcTo',
  'closePath', 'fill', 'clip', 'save', 'restore', 'translate', 'rotate', 'scale',
  'setTransform', 'font', 'measureText',
];

const bannedGlobals = new Set([
  'window', 'self', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
  'fetch', 'performance', 'Date',
]);
const screenMembers = new Set(SCREEN_MEMBERS);

function memberName(node: ts.Node): string | undefined {
  return ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : undefined;
}

/** Inspect executable syntax, so translated prose and comments may mention browser features. */
export function contractViolations(source: ts.SourceFile, checker: ts.TypeChecker): string[] {
  const failures: string[] = [];
  const restSources = new Map<ts.Symbol, ts.Expression>();
  // Plain `x = value` assignments, so an alias typed `any` still carries what was assigned to it.
  const assignedValues = new Map<ts.Symbol, ts.Expression[]>();
  const collectAssignments = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
      const symbol = checker.getSymbolAtLocation(node.left);
      if (symbol) assignedValues.set(symbol, [...(assignedValues.get(symbol) ?? []), node.right]);
    }
    ts.forEachChild(node, collectAssignments);
  };
  collectAssignments(source);
  const report = (node: ts.Node, message: string) => {
    const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
    failures.push(`${line + 1}:${character + 1} ${message}`);
  };
  const referenceSymbol = (node: ts.Identifier) => ts.isShorthandPropertyAssignment(node.parent)
    ? checker.getShorthandAssignmentValueSymbol(node.parent)
    : checker.getSymbolAtLocation(node);
  // The bare host supplies these browser-declared helpers; other DOM services belong behind ConsoleAPI.
  const shimGlobals = new Set(['atob', 'btoa', 'console']);
  const isForbiddenGlobal = (name: string, symbol: ts.Symbol | undefined) => bannedGlobals.has(name)
    || (!shimGlobals.has(name) && (symbol?.getDeclarations()?.some(declaration =>
      /[/\\]lib\.(dom|webworker)(\.[^/\\]+)?\.d\.ts$/.test(declaration.getSourceFile().fileName),
    ) ?? false));
  const isGlobal = (node: ts.Identifier) => {
    const declarations = referenceSymbol(node)?.getDeclarations();
    return !declarations?.length || declarations.every(d => d.getSourceFile().isDeclarationFile);
  };
  const hasNamedType = (type: ts.Type, names: string[]): boolean =>
    names.includes(type.getSymbol()?.getName() ?? '')
      || (type.isUnionOrIntersection() && type.types.some(part => hasNamedType(part, names)));
  const hasOrigin = (node: ts.Node, names: string[], seen = new Set<ts.Node>()): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (hasNamedType(checker.getTypeAtLocation(node), names)) return true;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) {
      return hasOrigin(node.expression, names, seen);
    }
    if (!ts.isIdentifier(node)) return false;
    if (names.includes(node.text) && isGlobal(node)) return true;
    const symbol = checker.getSymbolAtLocation(node);
    const assignedSource = symbol && restSources.get(symbol);
    if (assignedSource) return hasOrigin(assignedSource, names, seen);
    if (symbol && assignedValues.get(symbol)?.some(value => hasOrigin(value, names, seen))) return true;
    return symbol?.getDeclarations()?.some(declaration => {
      if ((ts.isVariableDeclaration(declaration) || ts.isParameter(declaration) || ts.isBindingElement(declaration)) && declaration.initializer) return hasOrigin(declaration.initializer, names, seen);
      if (ts.isBindingElement(declaration) && declaration.dotDotDotToken && ts.isObjectBindingPattern(declaration.parent)) {
        const owner = declaration.parent.parent;
        if (ts.isVariableDeclaration(owner) || ts.isParameter(owner)) return hasOrigin(owner.initializer ?? owner, names, seen);
      }
      return false;
    }) ?? false;
  };
  const isGlobalObject = (node: ts.Node) => hasOrigin(node, ['globalThis']);
  const isAPI = (node: ts.Expression) => hasOrigin(node, ['ConsoleAPI']);
  const isScreen = (node: ts.Node, seen = new Set<ts.Node>()): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (hasOrigin(node, ['Screen2D', 'CanvasRenderingContext2D'])) return true;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) {
      return isScreen(node.expression, seen);
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'g' && isAPI(node.expression)) return true;
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'g' && isAPI(node.expression)) return true;
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol && assignedValues.get(symbol)?.some(value => isScreen(value, seen))) return true;
      for (const declaration of symbol?.getDeclarations() ?? []) {
        if (ts.isVariableDeclaration(declaration) && declaration.initializer && isScreen(declaration.initializer, seen)) return true;
        if (ts.isBindingElement(declaration) && !declaration.dotDotDotToken && ts.isObjectBindingPattern(declaration.parent)) {
          const owner = declaration.parent.parent;
          if ((ts.isVariableDeclaration(owner) || ts.isParameter(owner)) && owner.initializer) {
            if (memberName(declaration.propertyName ?? declaration.name) === 'g' && isAPI(owner.initializer)) return true;
          }
        }
      }
    }
    return false;
  };
  const checkMember = (node: ts.Node, name: string | undefined, target: ts.Node) => {
    if (isScreen(target) && (!name || !screenMembers.has(name))) report(node, `Screen2D has no ${name ?? 'computed member'}`);
    if (isGlobalObject(target) && (!name || isForbiddenGlobal(name, checker.resolveName(name, undefined, ts.SymbolFlags.Value, false)))) report(node, `banned global ${name ?? 'computed member'}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) report(node, 'banned dynamic import()');
    if (ts.isPropertyAccessExpression(node)) checkMember(node, node.name.text, node.expression);
    if (ts.isElementAccessExpression(node)) checkMember(node, ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined, node.expression);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isObjectLiteralExpression(node.left)) {
      for (const property of node.left.properties) {
        if (ts.isSpreadAssignment(property) && ts.isIdentifier(property.expression)) {
          const symbol = checker.getSymbolAtLocation(property.expression);
          if (symbol) restSources.set(symbol, node.right);
        } else if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
          checkMember(property, memberName(property.name), node.right);
        }
      }
    }
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && ts.isObjectBindingPattern(node.name)) {
      for (const binding of node.name.elements) {
        if (!binding.dotDotDotToken) checkMember(binding, memberName(binding.propertyName ?? binding.name), node.initializer ?? node);
      }
    }
    if (ts.isIdentifier(node) && isGlobal(node) && isForbiddenGlobal(node.text, referenceSymbol(node))) {
      const parent = node.parent;
      // Property names are not global references: e.g. an art object's window or a translated label.
      const propertyName = (ts.isPropertyAccessExpression(parent) && parent.name === node)
        || (ts.isPropertyAssignment(parent) && parent.name === node)
        || (ts.isPropertySignature(parent) && parent.name === node)
        || (ts.isBindingElement(parent) && parent.propertyName === node);
      if (!propertyName) report(node, `banned global ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return failures;
}
