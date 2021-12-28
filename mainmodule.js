
let ratingInfo = { };

class RatingInfo
{
    constructor(name, anchor, boxart)
    {
        this.name = name;
        this.anchor = anchor;
        this.boxart = boxart;

        let ratingDiv = document.createElement("div");
        this.ratingDiv = ratingDiv;

        ratingDiv.style.position = "relative";
        ratingDiv.style.backgroundColor = "#000000a0";
        ratingDiv.style.top = "0px";
        ratingDiv.innerHTML = "Loading...";

        boxart.appendChild(ratingDiv);

        this.startLookup();
    }

    startLookup()
    {
        console.log("Starting lookup for: " + this.name);
        fetch("http://localhost:8000", {
            "method": "POST",
            "cache": 'no-cache',
            "headers": {
                "Content-Type": "text/plain",
            },
            "body": this.name
        })
        .then(response => response.json())
        .then((ratings) => {
            console.log(ratings);

            let html = "";
            for (let rater in ratings)
                html += rater + ": " + ratings[rater] + "<br>";
            this.ratingDiv.innerHTML = html;
        })
    }
};

function startMovieLookup(name, anchor, boxart)
{
    if (name in ratingInfo)
        return;

    ratingInfo[name] = new RatingInfo(name, anchor, boxart);
}

// https://stackoverflow.com/a/5354536/2828217
function checkVisible(elm)
{
    let rect = elm.getBoundingClientRect();
    let viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
    return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
}

function periodicLookupCheck()
{
    let images = document.querySelectorAll("img.boxart-image");
    for (let i of images)
    {
        if (i.lookupStarted)
            continue;

        let boxart = i.parentElement;
        let anchor = boxart.parentElement;
        let name = anchor.getAttribute("aria-label");
        let hidden = anchor.getAttribute("aria-hidden");
        if (hidden === "false")
        {
            if (checkVisible(i))
            {
                i.lookupStarted = true;
                startMovieLookup(name, anchor, boxart);
            }
        }
    }
}

function main()
{
    console.log("main(module)");
    if (window.rateFlixTimer !== undefined)
    {
        clearInterval(window.rateFlixTimer);
        console.log("Cleared old timer");
    }

    window.rateFlixTimer = setInterval(periodicLookupCheck, 1000);
}

console.log("Main module");
main();
