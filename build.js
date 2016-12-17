#! /usr/bin/env node

"use strict";

const argparse   = require("argparse");
const path       = require("path");

const Metalsmith = require("metalsmith");
const ms_ccss    = require("metalsmith-clean-css");
const ms_concat  = require("metalsmith-concat");
const ms_copy    = require("metalsmith-copy");
const ms_default = require("metalsmith-default-values");
const ms_express = require("metalsmith-express");
const ms_gzip    = require("metalsmith-gzip");
const ms_inplace = require("metalsmith-in-place");
const ms_layout  = require("metalsmith-layouts");
const ms_sass    = require("metalsmith-sass");
const ms_ugli    = require("metalsmith-uglify");
const ms_watch   = require("metalsmith-watch");

const ms_submod  = require("./lib/submodules.js");

function prepare_hbs()
{
    let cons = require('consolidate');
    let Handlebars = require('handlebars');
    cons.requires.handlebars = Handlebars;

    Handlebars.registerHelper('link_unless_self', (slug, dest, text) => {
        text = Handlebars.escapeExpression(text);
        if (slug === dest) {
            return new Handlebars.SafeString(
                '<span class="this-page">' + text + '</span>'
            );
        } else {
            dest = Handlebars.escapeExpression(dest);
            return new Handlebars.SafeString(
                '<a href="' + dest + '">' + text + '</a>'
            );
        }
    });

    Handlebars.registerHelper('livereload_hook', (context) => {
        if (context.livereload) {
            return new Handlebars.SafeString(
                '<script src="http://localhost:35729/livereload.js"></script>'
            );
        } else {
            return '';
        }
    });

    Handlebars.registerHelper('expand_cc', (license) => {
        const labels = {
            'by':       'Attribution',
            'by-nd':    'Attribution-NoDerivatives',
            'by-sa':    'Attribution-ShareAlike',
            'by-nc':    'Attribution-NonCommercial',
            'by-nc-nd': 'Attribution-NonCommercial-NoDerivatives',
            'by-nc-sa': 'Attribution-NonCommercial-ShareAlike'
        };
        let label = labels[license];
        if (label) return label;
        return '[*** Unrecognized license tag "' + license + '"]';
    });

}

function content_pipeline(options)
{
    let ms = Metalsmith(__dirname)
    .metadata(options.meta)
    .clean(true)
    .source("src")
    .ignore([
        "**/*~", "**/#*#", "**/.#*",
        "**/s/f/*.LICENSE"
    ])
    .use(ms_default([
        { pattern: "**/*",
          defaults: {
              license: "by-nc"
          }
        }
    ]))
    .use(ms_submod({
        "inc/normalize": { include: ["normalize.css"],
                           dest:    "s" },
        "inc/html5shiv": { include: ["dist/html5shiv-printshiv.js"],
                           dest:    "s" },
        "inc/mathjax":   { include: ["MathJax.*/**"],
                           dest:    "s",
                           precmd:  "./minify",
                           precmd_stdout: (stdout, metalsmith) => {
                               metalsmith.metadata()["MATHJAX_DIR"] =
                                   stdout.trim();
                           }
                         }
    }))

    // HTML-specific operations
    .use(ms_layout({
        pattern: "**/*.html",
        engine: "handlebars",
        default: "page.html"
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

    // JavaScript-specific operations
    .use(ms_inplace({
        pattern: "**/*.js.hbs",
        engine: "handlebars"
    }))

    // inplace doesn't know how to strip off a .hbs suffix
    .use(ms_copy({ pattern: "**/*.js.hbs", move: true,
                   transform: (old) => old.slice(0, -4) }))
    // html5shiv.js winds up in the wrong place
    .use(ms_copy({ pattern: "**/s/dist/**", move: true,
                   transform: (old) => old.replace(/(^|\/)s\/dist(\/|$)/,
                                                   "$1s$2") }));

    if (options.minify)
        ms = ms
        .use(ms_ccss({
            files: [ "s/style.css" ],
            cleanCSS: { "keepSpecialComments": 0 }
        }))
        .use(ms_ugli({
            nameTemplate: "[name].[ext]" // uglify in place
        }))
        .use(ms_gzip({
            src: ["**/*.html", "**/*.txt", "**/*.json", "**/*.svg",
                  "**/*.css", "**/*.css.map",
                  "**/*.js", "**/*.js.map"]
        }));

    return ms;
}

function do_build(args)
{
    let ORIGIN, livereload, minify, destination;
    if (args.production) {
        ORIGIN = "https://research.owlfolio.org";
        livereload = false;
        minify = true;
        destination = "render_p";
    } else {
        ORIGIN = "http://localhost:8000";
        livereload = true;
        minify = args.minify;
        destination = "render_d";
    }

    content_pipeline({ meta: { ORIGIN: ORIGIN, livereload: livereload },
                       minify: minify })
    .destination(destination)
    .build((err, files) => {
        if (err) throw err;
    });
}

function do_devserver(args)
{
    content_pipeline({ meta: { ORIGIN: "http://localhost:8000",
                               livereload: true },
                       minify: args.minify })
    .destination("render_d")
    .use(ms_watch({
        paths: {
            // Some of the pipeline steps can't handle partial rebuilds.
            "${source}/**/*": "**/*",
            "layouts/**/*": "**/*"
        },
        livereload: true
    }))
    .use(ms_express({
        host: 'localhost',
        port: 8000
    }))
    .build((err, files) => {
        if (err) throw err;
    });
}

function main()
{
    var ap = new argparse.ArgumentParser({
        addHelp: true,
        description: "Build script."
    });
    var sp = ap.addSubparsers({
        title: "operation",
        dest: "operation"
    });

    var bp = sp.addParser("build", { addHelp: true });
    bp.addArgument(["-p", "--production"], {
        action: "storeTrue",
        help: "Build for production website.  Implies -m."
    });
    bp.addArgument(["-m", "--minify"], {
        action: "storeTrue",
        help: "Enable minification."
    });

    var dp = sp.addParser("devserver", { addHelp: true });
    dp.addArgument(["-m", "--minify"], {
        action: "storeTrue",
        help: "Enable minification."
    });

    var args = ap.parseArgs();

    prepare_hbs();

    if (args.operation === "build") {
        do_build(args);
    } else if (args.operation === "devserver") {
        do_devserver(args);
    } else {
        ap.error("Unrecognized operation: '" + args.operation + "'");
    }
}

main();

// Local Variables:
// js2-skip-preprocessor-directives: t
// End:
/*global require, __dirname*/
