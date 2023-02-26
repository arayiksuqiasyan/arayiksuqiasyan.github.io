import React, {useEffect, useState} from "react";
import {Experience, Body, Header, Info,Tooling,Works} from "./pages";
import {SplashScreen} from "./components";

function App() {
    const [isAnimated, setIsAnimated] = useState(false)

    useEffect(() => {
        setIsAnimated(true)
        document.querySelector('body').style.overflow = 'hidden'

        const timeOut = setTimeout(() => {
            document.querySelector('body').style.overflow = 'visible'
            setIsAnimated(false)
        }, 1500)

        return () => {
            clearTimeout(timeOut)
        }
    }, [])


    return (
        <div className={'App'}>
            {/*<span>✌🏻,❤️️,💚,⚡,⭐,😍</span>*/}
            <Header/>
            <Body/>
            <Info/>
            <Experience/>
            <SplashScreen load={isAnimated}/>
            <Tooling/>
            <Works/>
        </div>
    );
}

export default App;
