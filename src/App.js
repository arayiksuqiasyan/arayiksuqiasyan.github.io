import React from "react";
import "./styles.scss";
import {Cursor, Nav} from "./components/ui";
import {PlayLauncher} from "./game/PlayLauncher";
import {About, Contact, Experience, Hero, Marquee, Playground, Portfolio, Skills} from "./sections";

function App() {
    return (
        <div className="app">
            <div className="scene" aria-hidden="true"/>
            <div className="noise" aria-hidden="true"/>
            <Cursor/>
            <Nav/>
            <PlayLauncher/>
            <main>
                <Hero/>
                <Marquee/>
                <About/>
                <Experience/>
                <Portfolio/>
                <Skills/>
                <Playground/>
                <Contact/>
            </main>
        </div>
    );
}

export default App;
