const request = require("request");
const rater = require("./rater.js");
const util = require("./util.js");

class MovieLensRater extends rater.Rater
{
    constructor()
    {
        super("movielens");
        this.jar = request.jar();
    }

    getMax()
    {
        return 5.0;
    }

    async init()
    {
        let data = await util.readFile("movielensaccount.json");
        let dict = JSON.parse(data);

        if (!("userName" in dict))
            throw "No 'userName' found in movielensaccount.json";
        if (!("password" in dict))
            throw "No 'password' found in movielensaccount.json";

        await util.requestGet({
                "url": "https://movielens.org/login",
                "jar": this.jar,
                "headers": { 
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                },
            });

        await util.requestPost({
                "url": "https://movielens.org/api/sessions",
                "jar": this.jar,
                "method": "post",
                "headers": { 
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                },
                "body": JSON.stringify(dict)
            });
    }

    async lookup(name)
    {
        let url = "https://movielens.org/api/movies/explore?q=" + util.fixedEncodeURIComponent(name);
        let browserUrl = "https://movielens.org/movies/explore?q=" + util.fixedEncodeURIComponent(name);
        let data = null;

        try
        {
            data = await util.requestGet({
                    "url": url,
                    "jar": this.jar,
                    "method": "get",
                    "headers": { 
                        "Accept": "application/json, text/plain, */*",
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                    },
                });
        }
        catch(err)
        {
            console.log(err);
            throw { "error": "Error loading search page", "url": browserUrl };
        }

        let movieId = null;

        try
        {
            let results = JSON.parse(data);
            results = results["data"]["searchResults"];

            for (let r of results)
            {
                if (r["movie"]["title"].toLowerCase().trim() == name.toLowerCase().trim())
                {
                    movieId = r["movieId"];
                    break;
                }
            }
        }
        catch(err)
        {
            console.log(err);
            throw { "error": "Error looking for movie on search page", "url": browserUrl };
        }

        if (movieId === null)
        {
            console.log("Can't find movie on page: " + name);
            console.log(data);
            throw { "error": "No matching movie name found", "url": browserUrl };
        }
                    
        url = "https://movielens.org/api/movies/" + movieId;
        browserUrl = "https://movielens.org/movies/" + movieId;

        try
        {
            data = await util.requestGet({
                    "url": url,
                    "jar": this.jar,
                    "method": "get",
                    "headers": { 
                        "Accept": "application/json, text/plain, */*",
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                    },
                });
        }
        catch(err)
        {
            console.log(err);
            throw { "error": "Error loading movie page", "url": browserUrl };
        }

        try
        {
            let results = JSON.parse(data);
            let movieUserData = results["data"]["movieDetails"]["movieUserData"];
            let rating = movieUserData["rating"];
            let pred = movieUserData["prediction"];

            let s = null;
            if (rating === null)
                s = { "rating": parseFloat(pred), "type": "predicted", "url": browserUrl };
            else
                s = { "rating": parseFloat(rating), "type": "rated", "url": browserUrl };

            return s;
        }
        catch(err)
        {
            console.log(err);
            throw { "error": "Can't get rating from movie page", "url": browserUrl };
        }
    }
}

/*
async function main()
{
    let rater = new MovieLensRater();
    await rater.init();

    let ratingInfo = await rater.lookup("The prestige");
    console.log("Rating info:");
    console.log(ratingInfo);
}

main()
.then(() => console.log("Finished"))
.catch((e) => { console.log("Error in main:"); console.log(e); })
*/

exports.MovieLensRater = MovieLensRater;
