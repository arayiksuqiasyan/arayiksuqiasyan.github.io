import React from "react";
import classes from './Loading.module.scss'

export const SplashScreen = ({load}) => {
    return (
        <>
            {load &&
                <div className={classes.wrapper} >
                    <div className={classes.loading} >
                        Loading
                        <span/>
                    </div>
                </div>
            }
        </>
    )
}
