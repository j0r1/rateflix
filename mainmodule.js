
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

    startLookup(name)
    {
        let xhr = new XMLHttpRequest();
        xhr.open("POST", "http://localhost:8000");
        xhr.onload = (e) => {
            let ratings = "" + xhr.response;
            console.log(ratings);
            ratings = JSON.parse(ratings);

            let html = "";
            for (let rater in ratings)
                html += rater + ": " + ratings[rater] + "<br>";
            this.ratingDiv.innerHTML = html;
        };
        xhr.send(this.name);
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

function main()
{
    console.log("main(module)");

    let images = document.querySelectorAll("img.boxart-image");
    for (let i of images)
    {
        let boxart = i.parentElement;
        let anchor = boxart.parentElement;
        let name = anchor.getAttribute("aria-label");
        let hidden = anchor.getAttribute("aria-hidden");
        if (hidden === "false")
            if (checkVisible(i))
                startMovieLookup(name, anchor, boxart);
    }
}

console.log("Main module");
main();
