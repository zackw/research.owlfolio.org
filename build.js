#! /usr/bin/env node

"use strict";

const Metalsmith = require('metalsmith');
const ms_sass    = require('metalsmith-sass');
const ms_concat  = require('metalsmith-concat');
const ms_ccss    = require('metalsmith-clean-css');
const ms_inplace = require('metalsmith-in-place');
const ms_gzip    = require('metalsmith-gzip');
const ms_renamer = require('metalsmith-renamer');
const ms_ugli    = require('metalsmith-uglify');

const ms_submod  = require('./lib/submodules.js');

Metalsmith(__dirname)
    .metadata({
        title: "",
        description: "",
        author: ""
    })
    .source('src')
    .destination('rendered')
    .ignore([
        "**/*~", "**/#*#", "**/.#*",
        "**/s/f/*.LICENSE"
    ])
    .use(ms_submod({
        "inc/normalize": { include: ["normalize.css"],
                           dest:    "s" },
        "inc/mathjax":   { include: ["MathJax.*/**"],
                           dest:    "s",
                           precmd:  "./minify",
                           precmd_stdout: (stdout, metalsmith) => {
                               metalsmith.metadata()['MATHJAX_DIR'] =
                                   stdout.trim();
                           }
                         }
    }))

    // CSS-specific operations
    .use(ms_sass({
        outputStyle: "expanded"
    }))
    .use(ms_concat({
        files: [ "s/f/MostraNuova-Regular.css",
                 "s/normalize.css",
                 "s/main.css" ],
        output: "s/style.css"
    }))
    .use(ms_ccss({
        files: [ "s/style.css" ],
        cleanCSS: { "keepSpecialComments": 0 }
    }))

    // JavaScript-specific operations
    .use(ms_inplace({
        pattern: "**/*.js.hbs",
        engine: "handlebars"
    }))
    // inplace doesn't know how to strip off a .hbs suffix
    .use(ms_renamer({
        js: { pattern: "**/*.js.hbs",
              rename: (old) => old.slice(0, -4) }
    }))
    .use(ms_ugli({
        nameTemplate: '[name].[ext]' // uglify in place
    }))

    // Final global operations
    .use(ms_gzip({
        src: ["**/*.html", "**/*.txt", "**/*.json", "**/*.svg",
              "**/*.css", "**/*.css.map",
              "**/*.js", "**/*.js.map"]
    }))
    .build((err, files) => {
        if (err) throw err;
    });


// Local Variables:
// js2-skip-preprocessor-directives: t
// End:
/*global require, __dirname*/
