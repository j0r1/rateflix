const { WorkerData, parentPort } = require('worker_threads')

const imdb = require("./imdbrater.js");
const rotten = require("./rottentomatoesrater.js");
const movielens = require("./movielensrater.js");
const tmdb = require("./tmdbrater.js");

const raterList = [
    new imdb.IMDBRater(),
    new rotten.RottenTomatoesRater(),
    new movielens.MovieLensRater(),
    new tmdb.TMDBRater(),
];

const raters = {};
for (let r of raterList)
    raters[r.getName()] = r;

function initializeRaters()
{
    let promises = [];
    for (let r in raters)
        promises.push(raters[r].init());

    return Promise.all(promises);
}

function incomingMessage(msg)
{
    let name = msg;
    console.log("Looking up: " + name);

    let movieResults = { "name": name, "results": { } };
    let results = movieResults.results;

    let promises = [];
    for (let r in raters)
    {
        let p = raters[r].lookup(name)
        .then((ratingInfo) => { results[r] = ratingInfo; results[r]["max"] = raters[r].getMax(); })
        .catch((errInfo) => { results[r] = errInfo });

        promises.push(p);
    }

    Promise.allSettled(promises).then(() => {
        parentPort.postMessage(JSON.stringify(movieResults));
        console.log(movieResults);
    });
}

async function main()
{
    await initializeRaters();
    console.log("Raters initialized");
    parentPort.on("message", incomingMessage);
}

main();
