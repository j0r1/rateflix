
function main()
{
    console.log("main(module)");

    let images = document.querySelectorAll("img.boxart-image");
    for (let i of images)
    {
        let name = i.parentElement.parentElement.getAttribute("aria-label");
        console.log(`Name: ${name}`);
    }
}

console.log("Main module");
main();
