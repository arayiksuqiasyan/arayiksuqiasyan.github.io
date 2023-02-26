import React from "react";
import classes from "./Info.module.scss"
import {ReactComponent as Dots} from "../../decors-paths/dots.svg";
import {ReactComponent as ZigZag} from "../../decors-paths/zig-zag.svg";
import {ReactComponent as DotsLine} from "../../decors-paths/dotes-line.svg";
import Wind from "../../components/animations/Wind/Wind";

export const Info = () => {
    return (
        <div data-id={'info-section'} className={classes.container}>
            <div className={classes.sectionOne}>
                <Wind sx={'span'} className={classes.title}>About</Wind>
                <Wind sx={'span'}>
                    Over the 2 years of my career,I have worked on many projects <br/>
                    that requiredReact, React Native development skills. <br/>
                    Someof the latestcompanies I have worked with are listed <br/>
                    below:
                    <a href={'https://www.inkin.com/'} target={'_blank'} rel={'noreferrer'}>inKin</a>&nbsp;&nbsp;
                    <a href={'https://www.truckindigital.com/'} target={'_blank'}
                       rel={'noreferrer'}>truckindigital</a>&nbsp;&nbsp;
                    <a href={'https://airdrop.com'} target={'_blank'} rel={'noreferrer'}>airdrop</a>&nbsp;&nbsp;
                    <a href={'https://sezame.app/'} target={'_blank'} rel={'noreferrer'}>Sezame Wallet</a>
                </Wind>
                <ZigZag className={classes.zigZag}/>
                <DotsLine className={classes.dotsLine}/>
            </div>
            <div className={classes.sectionTwo}>
                <Wind sx={'span'} className={classes.title}>Engineering</Wind>
                <Wind sx={'span'}>
                    In building JavaScript applications, I'm equipped with <br/>
                    just the right tools, and can absolutely function independently <br/>
                    of them to deliver fast, resilient solutions optimized for scale —<br/>
                    performance and scalabilty are priorities on my radar.
                </Wind>
                <Dots className={classes.dots}/>
                <DotsLine className={classes.dotsLine}/>
            </div>
        </div>
    )
}