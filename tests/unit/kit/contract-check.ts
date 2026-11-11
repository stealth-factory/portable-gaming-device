import ts from 'typescript';

/** The drawing surface frozen by disk contract v1, rather than whichever Canvas a host supplies. */
export const SCREEN_MEMBERS = [
  'fillStyle', 'fillRect', 'beginPath', 'rect', 'moveTo', 'lineTo', 'arc', 'arcTo',
  'closePath', 'fill', 'clip', 'save', 'restore', 'translate', 'rotate', 'scale',
  'setTransform', 'font', 'measureText',
];

const bannedGlobals = new Set([
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location',
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
  const report = (node: ts.Node, message: string) => {
    const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
    failures.push(`${line + 1}:${character + 1} ${message}`);
  };
  const isGlobal = (node: ts.Identifier) => {
    const declarations = checker.getSymbolAtLocation(node)?.getDeclarations();
    return !declarations?.length || declarations.every(d => d.getSourceFile().isDeclarationFile);
  };
  const isGlobalObject = (node: ts.Expression, seen = new Set<ts.Node>()): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (checker.getTypeAtLocation(node).getSymbol()?.getName() === 'globalThis') return true;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) {
      return isGlobalObject(node.expression, seen);
    }
    if (!ts.isIdentifier(node)) return false;
    if (node.text === 'globalThis' && isGlobal(node)) return true;
    return checker.getSymbolAtLocation(node)?.getDeclarations()?.some(declaration =>
      ts.isVariableDeclaration(declaration) && !!declaration.initializer && isGlobalObject(declaration.initializer, seen),
    ) ?? false;
  };
  const isScreen = (node: ts.Expression, seen = new Set<ts.Node>()): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    const type = checker.getTypeAtLocation(node);
    if (type.getSymbol()?.getName() === 'Screen2D' || type.getSymbol()?.getName() === 'CanvasRenderingContext2D') return true;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) {
      return isScreen(node.expression, seen);
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'g') return true;
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'g') return true;
    if (ts.isIdentifier(node)) {
      for (const declaration of checker.getSymbolAtLocation(node)?.getDeclarations() ?? []) {
        if (ts.isVariableDeclaration(declaration) && declaration.initializer && isScreen(declaration.initializer, seen)) return true;
        if (ts.isBindingElement(declaration) && ts.isObjectBindingPattern(declaration.parent)) {
          const owner = declaration.parent.parent;
          if (ts.isVariableDeclaration(owner) && owner.initializer) {
            if (memberName(declaration.propertyName ?? declaration.name) === 'g') return true;
          }
        }
      }
    }
    return false;
  };
  const checkMember = (node: ts.Node, name: string | undefined, target: ts.Expression) => {
    if (isScreen(target) && (!name || !screenMembers.has(name))) report(node, `Screen2D has no ${name ?? 'computed member'}`);
    if (isGlobalObject(target) && (!name || bannedGlobals.has(name))) report(node, `banned global ${name ?? 'computed member'}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) report(node, 'banned dynamic import()');
    if (ts.isPropertyAccessExpression(node)) checkMember(node, node.name.text, node.expression);
    if (ts.isElementAccessExpression(node)) checkMember(node, ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined, node.expression);
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
      for (const binding of node.name.elements) {
        if (!binding.dotDotDotToken) checkMember(binding, memberName(binding.propertyName ?? binding.name), node.initializer);
      }
    }
    if (ts.isIdentifier(node) && bannedGlobals.has(node.text) && isGlobal(node)) {
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
