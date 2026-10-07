"use strict";

module.exports = function assertBoundedAst(ast) {
  const pending = [{ node: ast, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { node, depth } = pending.pop();
    if (depth > 128 || ++count > 65536 || pending.length > 65536) {
      throw new SyntaxError("FutureVote: brace AST exceeds safe depth/size limit");
    }
    if (node && Array.isArray(node.nodes)) {
      if (node.nodes.length > 65536) throw new SyntaxError("FutureVote: brace AST exceeds safe size limit");
      for (const child of node.nodes) pending.push({ node: child, depth: depth + 1 });
    }
  }
};
