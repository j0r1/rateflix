const fetch = require("node-fetch"); // npm install node-fetch@2.0
const jsdom = require("jsdom"); // npm install jsdom
const { JSDOM } = jsdom;
const he = require("he"); // npm install he
const util = require("./util.js");
const rater = require("./rater.js");

class TMDBRater extends rater.Rater
{
    constructor()
    {
        super("tmdb");
    }

    async init()
    {
        return true;
    }

    async lookup(name)
    {
        let url = null;
        let text = null;

        try
        {
            url = "https://www.themoviedb.org/search?query=" + util.fixedEncodeURIComponent(name);
            let response = await fetch(url);
            text = await response.text();
        }
        catch(err)
        {
            console.log(err);
            throw [ "Error loading search page", url ];
        }

        let movieUrl = null;

        try
        {
            //console.log(text);
            let dom = new JSDOM(text);
            let h = dom.window.document.querySelector("a.result h2");
            let titleHref = h.parentElement.getAttribute("href");
            movieUrl = "https://www.themoviedb.org" + titleHref ;
        }
        catch(err)
        {
            console.log(err);
            throw [ "Error looking for movie url in page", url ];
        }

        try
        {
            //console.log("Loading " + movieUrl);
            let response = await fetch(movieUrl);
            text = await response.text();
        }
        catch(err)
        {
            console.log(err);
            throw [ "Error fetching movie url", movieUrl ];
        }

        try
        {
            //console.log(text);
            let dom = new JSDOM(text);
            let div = dom.window.document.querySelector("div.user_score_chart");
            let pct = div.getAttribute("data-percent");
            return [pct, movieUrl];
        }
        catch(err)
        {
            console.log(err);
            throw ["Error getting imdb score from page", url];
        }
    }
};

async function main()
{
    let rater = new TMDBRater();
    await rater.init();

    let [ rating, url ] = await rater.lookup("The matrix reloaded");
    console.log("Rating: " + rating);
    console.log("Url: " + url);
}

main()
.then(() => console.log("Finished"))
.catch((e) => { console.log("Error in main:"); console.log(e); })

exports.TMDBRater = TMDBRater;
