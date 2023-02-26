import React from "react";
import {motion, useScroll, useSpring, useTransform, useVelocity} from "framer-motion";

const Wind = ({sx = 'div', children, style, ...props}) => {
    const {scrollYProgress} = useScroll()
    const xSmooth = useSpring(scrollYProgress, {damping: 50, stiffness: 1000, duration: 1});
    const xVelocity = useVelocity(xSmooth);

    const rotateX = useTransform(xVelocity, [-0.3, 0, 0.3], [-20, 0, 20], {clamp: true});
    const rotateY = useTransform(xVelocity, [-0.6, 0, 0.6], [8, 0, 8], {clamp: true});
    const transformOrigin = useTransform(xVelocity, [-0.6, 0, 0.6], ['right', 'right', 'left'], {clamp: false});

    const MotionTag = motion(sx)

    return (
        <MotionTag
            style={{rotateX, rotateY, transformOrigin, ...style}}
            {...props}
        >
            {children}
        </MotionTag>
    )
}

export default Wind