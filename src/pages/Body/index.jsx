import React, {useRef} from "react";
import classes from './Body.module.scss'
import avatar from '../../photo/avatar.jpg'
import {ReactComponent as Dots} from "../../decors-paths/dots.svg";
import {ReactComponent as ZigZag} from "../../decors-paths/zig-zag.svg";
import {motion, useScroll, useTransform} from "framer-motion";
import Wind from "../../components/animations/Wind/Wind";

export const Body = (props) => {
    const ref = useRef(null)
    const {scrollYProgress} = useScroll({target: ref, offset: ["-120px start", "start start"]})
    const scale = useTransform(scrollYProgress, [0, 1], [1, 1.15])
    const height = useTransform(scrollYProgress, [0, 1], ['101.5%', '0%'])

    return (
        <div className={classes.container}>
            <div className={classes.firstBlock}>
                <div className={classes.left}>
                    <Wind sx={'h1'}>Frontend <br/> Developer.</Wind>
                    <Wind sx={'p'}>I like to craft solid and scalable frontend products <br/> with great user
                        experiences.</Wind>
                </div>
                <div ref={ref} className={classes.right}>
                    <motion.img style={{scale}} id={'avatar'} src={avatar} alt="avatar"/>

                    <div className={classes.borderImg}>
                        <motion.div style={{height}} className={classes.progressY}/>
                        <motion.div style={{width: height}} className={classes.progressX}/>
                    </div>

                    <Dots className={classes.dotsPurple}/>
                    <Dots className={classes.dotsGreen}/>
                    <ZigZag className={classes.zigzagPurple}/>
                    <ZigZag className={classes.zigzagGreen}/>
                    <ZigZag className={classes.zigzagGreen2}/>
                </div>
            </div>
            <div className={classes.subTitles}>
                <Wind sx={'span'}>
                    Highly skilled in progressive <br/> enhancement, systems design <br/> and user
                    interface development.
                </Wind>
                <Wind sx={'span'}>
                    More than two years of experience <br/> in creating products for clients <br/> in
                    several countries .
                </Wind>
            </div>
        </div>
    )
}
