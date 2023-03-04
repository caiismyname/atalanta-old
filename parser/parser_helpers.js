
//
//
//
// Helper functions
//
//
//


//
// JS helpers
//

function print(x) {
    console.log(x)
}

export function arraysAreEqual(a, b) {
    return a.length === b.length && a.every((val, index) => val === b[index]);
}

//
// Math helpers
//

export function averageDistanceToCluster(item, cluster) { // Just an average of all the individual points across the same position in the vector
    if (cluster.length === 0) {
        return 999999999
    }
    let centroidFeature = computeCentroid(cluster)
    return distanceBetweenNDPoints(centroidFeature, item)
}

export function distanceBetweenNDPoints(a, b) {
    let featureCount = a.length
    let resultVector = []

    for (let i = 0; i < featureCount; i++) {
        resultVector[i] = Math.pow(a[i] - b[i], 2)
    }

    return Math.pow(resultVector.reduce((a, b) => a + b, 0), 0.5)
}

export function computeCentroid(cluster) {
    let featureCount = cluster[0].length
    let centroidFeature = []

    for (let i = 0; i < featureCount; i++) {
        centroidFeature.push(cluster.reduce((a, b) => a + b[i], 0) / cluster.length)
    }

    return centroidFeature
}

export function computeWCSS(cluster) { // Within Cluster Sum of Squares
    if (cluster.length === 0) {
        return 0
    }
    let centroid = computeCentroid(cluster)
    var wcss = 0.0

    for (item of cluster) {
        wcss += Math.pow(distanceBetweenNDPoints(centroid, item), 2)
    }

    return wcss
}

export function standardDeviation(items) {
    let average = items.reduce((a, b) => a + b, 0) / items.length
    let sumOfSquares = items.reduce((a, b) => a + Math.pow(b - average, 2), 0)
    let stdDev = Math.pow(sumOfSquares / items.length, 0.5)

    return stdDev
}

//
// Running time/dist. helpers
//

export function metersToMiles(meters) {
    return meters * 0.000621371
}

export function metersToMilesRounded(meters) {
    return Math.round(metersToMiles(meters))
}

export function secondsToMinutes(seconds) {
    if (seconds % 60 === 30) { // half minute
        return Math.round((seconds - 30) / 60) + 0.5
    } else {
        return Math.round(seconds / 60)
    }
}

export function secondsPerMile(lap) {
    let distanceMiles = metersToMiles(lap.distance)
    let secondsPerMile = lap.moving_time / distanceMiles

    return secondsPerMile
}

export function averagePaceOfSet(set) {
    let totalTime = set.laps.reduce((a, b) => a + b.moving_time, 0)
    let totalDistance = set.laps.reduce((a, b) => a + b.distance, 0)

    return pacePerMileFormatted({"distance": totalDistance, "moving_time": totalTime})
}


// 
// Printing helpers
//

export function pacePerMileFormatted(lap) {
    return secondsToTimeFormatted(secondsPerMile(lap))
}

export function averageTimeOfSetFormatted(set) {
    let averageSeconds = set.laps.reduce((a, b) => a + b.moving_time, 0) / set.laps.length
    return secondsToTimeFormatted(averageSeconds)
}

export function averageDistanceOfSetFormatted(set) {
    let averageDistance = set.laps.reduce((a, b) => a + b.distance, 0) / set.laps.length
    let roundedMiles = metersToMiles(averageDistance).toFixed(2)

    return roundedMiles
}

export function secondsFormatter(input, shouldRound) {
    var rounded;

    if (shouldRound) {
        rounded = Math.round(input)
    } else {
        rounded = input.toFixed(1)
    }
    

    if (rounded === 0) {
        return {
            seconds: "00",
            minuteDiff: 0
        }
    } else if (rounded < 10) {
        return {
            seconds: "0" + rounded,
            minuteDiff: 0
        }
    } else if (rounded === 60) {
        return {
            seconds: "00",
            minuteDiff: 1
        }
    }

    return {
        seconds: rounded,
        minuteDiff: 0
    }
}

export function indented(input, indentLevel = 1) {
    return "  ".repeat(indentLevel) + input + "\n"
}

export function secondsToTimeFormatted(seconds) {
    let minutes = Math.floor(seconds / 60)
    let shouldRound = minutes > 0 // Only round if less than 1min
    let secondsRes = secondsFormatter(seconds % 60, shouldRound)

    if (minutes === 0) {
        return (minutes + secondsRes.minuteDiff) + ":" + secondsRes.seconds
    } else {
        return (minutes + secondsRes.minuteDiff) + ":" + secondsRes.seconds
    }
}