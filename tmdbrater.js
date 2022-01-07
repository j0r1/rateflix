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

    getMax()
    {
        return 100.0;
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
            throw { "error": "Error loading search page", "url": url };
        }

        let movieUrl = null;
        let isMovie = false;

        try
        {
            //console.log(text);
            let dom = new JSDOM(text);
            let h = dom.window.document.querySelector("a.result h2");
            let titleHref = h.parentElement.getAttribute("href");
            movieUrl = "https://www.themoviedb.org" + titleHref ;

            if (titleHref.startsWith("/movie/"))
                isMovie = true;
        }
        catch(err)
        {
            console.log(err);
            throw { "error": "Error looking for movie url in page", "url": url };
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
            throw { "error": "Error fetching movie url", "url": movieUrl };
        }

        try
        {
            //console.log(text);
            let dom = new JSDOM(text);
            let div = dom.window.document.querySelector("div.user_score_chart");
            let pct = parseFloat(div.getAttribute("data-percent"));

            return {
                "score": pct,
                "url": movieUrl,
                "ismovie": isMovie
            }
        }
        catch(err)
        {
            console.log(err);
            throw { "error": "Error getting tmdb score from page", "url": url};
        }
    }
};

async function main()
{
    let rater = new TMDBRater();
    await rater.init();

    let ratingInfo = await rater.lookup("The matrix reloaded");
    console.log("Rating:");
    console.log(ratingInfo);
}

main()
.then(() => console.log("Finished"))
.catch((e) => { console.log("Error in main:"); console.log(e); })

exports.TMDBRater = TMDBRater;
