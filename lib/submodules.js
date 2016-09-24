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

const Promise        = require("bluebird");
const multimatch     = require("multimatch");
const path           = require("path");
const read_recursive = require("readdir-recursive-promise").readdirAsync;
const spawn          = require("child_process").spawn;

function flatten_listing (listing, subdir)
{
    subdir = subdir || "";
    let paths = [];
    for (let entry of listing.files) {
        let relname = path.join(subdir, entry.name);
        if ("files" in entry)
            paths.push.apply(paths, flatten_listing(entry, relname));
        else
            paths.push(relname);
    }
    return paths;
}

function filter_fnames (fnames, includes, excludes)
{
    return multimatch(fnames, includes).filter(fname => {
        return multimatch([fname], excludes).length === 0;
    });
}

function decode_options (opts)
{
    let modules = [];
    for (let key in opts) {
        if (!opts.hasOwnProperty(key)) continue;
        let val = opts[key];

        if (typeof val === "string")
            modules.push({ src: key, include: [val], dest: key });
        else if (Array.isArray(val))
            modules.push({ src: key, include: val, dest: key });
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
    return modules;
}

function await_child(proc)
{
    return new Promise((resolve, reject) => {
        proc.on("error", reject);
        proc.on("exit", (code, signal) => {
            if (signal !== null)
                reject("Child killed by signal: " + signal);
            else if (code)
                reject("Child exited with status " + code);
            else
                resolve();
        });
    });
}

function maybe_execute_precmd (mod, cwd, metalsmith)
{
    if (mod.precmd) {
        let cmd, args;
        if (Array.isArray(mod.precmd)) {
            cmd = mod.precmd[0];
            args = mod.precmd.slice(1);
        } else {
            if (typeof mod.precmd !== "string")
                throw new Error("invalid precmd: " + mod.precmd);
            cmd = mod.precmd;
            args = [];
        }

        let stdio;
        if ("precmd_stdout" in mod)
            stdio = [ 'ignore', 'pipe', 'inherit' ];
        else
            stdio = [ 'ignore', 'ignore', 'inherit' ];

        let proc = spawn(cmd, args, {
            cwd: path.join(cwd, mod.src),
            stdio: stdio
        });
        if ("precmd_stdout" in mod) {
            let stdout = "";
            proc.stdout.on("data", data => { stdout += data; });
            return await_child(proc).then(() => {
                mod.precmd_stdout(stdout, metalsmith);
            });
        }
        else
            return await_child(proc);
    } else
        return Promise.resolve();
}

module.exports = function submodules_plugin (opts)
{
    let modules = decode_options(opts);
    let cwd = process.cwd();

    return function submodules_process (files, metalsmith)
    {
        let readFile = Promise.promisify(metalsmith.readFile,
                                         { context: metalsmith });

        return Promise.map(modules, (mod) => {
            return maybe_execute_precmd(mod, cwd, metalsmith)
                .then(() => read_recursive(mod.src))
                .then((listing) => {
                    let fnames = filter_fnames(flatten_listing(listing),
                                               mod.include,
                                               metalsmith.ignores);
                    return Promise.map(fnames, fn => {
                        readFile(path.join(cwd, mod.src, fn))
                            .then(contents => {
                                files[path.join(mod.dest, fn)] = contents;
                            });
                    });
                });
        });
    };
};

/*global module, require, process*/
