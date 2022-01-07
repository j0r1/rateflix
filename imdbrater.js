const fetch = require("node-fetch"); // npm install node-fetch@2.0
const jsdom = require("jsdom"); // npm install jsdom
const { JSDOM } = jsdom;
const he = require("he"); // npm install he
const util = require("./util.js");
const rater = require("./rater.js");

class IMDBRater extends rater.Rater
{
    constructor()
    {
        super("imdb");
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
            url = "https://www.imdb.com/find?q=" + util.fixedEncodeURIComponent(name) + "&s=tt&exact=true";
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
            let dom = new JSDOM(text);
            let td = dom.window.document.querySelector("td.result_text");
            let a = td.querySelector("a");
            let titleHref = a.getAttribute("href");
            movieUrl = "https://www.imdb.com/" + titleHref ;
        }
        catch(err)
        {
            console.log(err);
            throw [ "Error looking for movie url in page", url ];
        }

        try
        {
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
            let dom = new JSDOM(text);
            let divs = dom.window.document.querySelectorAll("div");
            let div = null;

            for (let d of divs)
            {
                if (d.getAttribute("data-testid") === "hero-rating-bar__aggregate-rating__score")
                {
                    div = d;
                    break;
                }
            }

            let span = div.querySelector("span");
            return [span.textContent, movieUrl];
        }
        catch(err)
        {
            console.log(err);
            throw ["Error getting imdb score from page", url];
        }
    }
};

/*
async function main()
{
    let rater = new IMDBRater();
    await rater.init();

    let [ rating, url ] = await rater.lookup("The matrix reloaded");
    console.log("Rating: " + rating);
    console.log("Url: " + url);
}

main()
.then(() => console.log("Finished"))
.catch((e) => { console.log("Error in main:"); console.log(e); })
*/

exports.IMDBRater = IMDBRater;
