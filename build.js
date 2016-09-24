#! /usr/bin/env node

const Metalsmith = require('metalsmith');
const ms_sass    = require('metalsmith-sass');
const ms_concat  = require('metalsmith-concat');
const ms_ccss    = require('metalsmith-clean-css');
const ms_gzip    = require('metalsmith-gzip');

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
                           precmd:  "./minify" }
    }))
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
