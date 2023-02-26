import React from "react";
import classes from './Tooling.module.scss'
import {TOOLS} from "../../constacts";

export const Tooling = (props) => {

    return (
        <div className={classes.container}>
            <div className={classes.tooling}>
                <span>Tooling</span>
            </div>
            <div className={classes.toolsBlock}>
                {
                    TOOLS.map((el,i)=>{
                        return (
                            <div
                                key={i}
                                className={classes.tool}
                            >
                                {el?.name}
                            </div>
                        )
                    })
                }
            </div>
        </div>
    )
}
