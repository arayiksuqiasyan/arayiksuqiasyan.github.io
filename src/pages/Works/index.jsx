import React from "react";
import classes from './Works.module.scss'
import {GIT_WORKS} from "../../constacts";

export const Works = () => {

    return (
        <div className={classes.container}>
            <div className={classes.title}>
                <span>{"{"}</span>
                <span>All Works</span>
                <span>{"}"}</span>
            </div>

            <div className={classes.gitWorks}>
                {
                    GIT_WORKS.map((el, i) => {
                        return (
                            <div
                                key={el.id}
                                className={`${classes.work} ${i % 2 !== 0 && classes.workReverse}`}
                            >
                                <div className={classes.card}>
                                    <a
                                        href={el.url}
                                        target={'_blank'}>
                                        <img src={el.img} alt="#"/>
                                    </a>
                                </div>
                                <div className={classes.cardDescription}>
                                    <h1>{el.title}</h1>
                                </div>
                            </div>
                        )
                    })
                }
            </div>
        </div>
    )
}
