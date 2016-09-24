// Git submodule assimilation plugin for Metalsmith.
//
// This is not unlike "flatten" or "elevate", except that it expects
// the submodules to be entirely outside the source directory, and it
// expects not to load everything from each submodule.  The options
// dictionary should look like this:
//
// { "foo" : ["**/*.js"],
//   "bar" : { "include":  ["blah.html"],
//             "dest": "renamed" }
// }
//
// Given this configuration, the plugin will look for directories
// "foo" and "bar" at top level.  All .js files in all subdirectories
// of "foo" will be added to 'files' as foo/path/file.js.  bar/blah.html
// will be added to 'files' as renamed/blah.html.

"use strict";

var multimatch = require("multimatch");
var path       = require("path");
var readdir    = require("recursive-readdir");

module.exports = function submodules_plugin (opts) {
    var modules = [];
    for (var key in opts) {
        if (!opts.hasOwnProperty(key)) continue;
        var val = opts[key];
        if (typeof val === "string")
            modules.push({ "src": key, "include": [val], "dest": key });
        else if (Array.isArray(val))
            modules.push({ "src": key, "include": val, "dest": key });
        else {
            if (val.hasOwnProperty("src"))
                throw new Error("submodules: " + key +
                                ": may not have a 'src' property");
            if (!val.hasOwnProperty("include"))
                throw new Error("submodules: " + key +
                                ": missing include pattern");

            val.src = key;
            if (!val.hasOwnProperty("dest"))
                val.dest = key;
            modules.push(val);
        }
    }

    return function submodules_process (files, metalsmith, done) {
        var i = 0;
        var cwd = process.cwd();
        function submodules_process_1 () {
            if (i == modules.length) {
                done();
                return;
            }
            var mod = modules[i];
            i++;
            function submodules_process_2 (err, fnames) {
                if (err) throw err;
                var relnames = [];
                for (var fn of fnames)
                    relnames.push(path.relative(mod.src, fn));
                var filtered = multimatch(relnames, mod.include);

                var f = 0;
                function submodules_process_3 () {
                    if (f == filtered.length) {
                        submodules_process_1();
                        return;
                    }

                    var fname = filtered[f];
                    f++;
                    function submodules_process_4 (err, contents) {
                        if (err) throw err;
                        files[path.join(mod.dest, fname)] = contents;
                        submodules_process_3();
                    }
                    metalsmith.readFile(path.join(cwd, mod.src, fname),
                                        submodules_process_4);
                }
                submodules_process_3();
            }
            readdir(mod.src, submodules_process_2);
        }
        submodules_process_1();
    };
};

/*global module, require, process*/
