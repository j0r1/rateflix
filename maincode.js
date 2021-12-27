function main()
{
    console.log("main");
    const mod = import("./mainmodule.js?" + Date.now());
}

console.log("maincode.js");
main();
window.getRateFlixMain = main;
