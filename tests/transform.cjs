const ts = require("typescript");
module.exports = {
  process(source, path) {
    return {
      code: ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
        },
        fileName: path,
      }).outputText,
    };
  },
};
