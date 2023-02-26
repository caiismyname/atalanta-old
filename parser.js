const examples = require('./examples.json');

function print(x) {
    console.log(x)
}

for (let run of examples['examples']) {
    let workoutsIdentifiedLaps = tagIsWorkout(run.laps)
    let mergedLaps = mergeAbutingLaps(workoutsIdentifiedLaps)
    tagWorkoutTypes(mergedLaps) // Mutates in place
    let sets = extractPatterns(mergedLaps.filter(lap => lap.isWorkout))


    console.log("---------------- " + run.name)
    // for (set of sets) {
    //     if (set.laps[0].length === 0) {
    //         print(set)
    //     }
    // }


    print(printSets(sets))
    // for (let lap of mergedLaps) {
    //     console.log(lap.lap_index + " " + lap.distance + " " + lap.moving_time);

    //     if (lap.isWorkout) {
    //         if (lap.workoutBasis === "DISTANCE") {
    //             console.log( "              " + 
    //                 (lap.isWorkout ? lap.closestDistance + " " + lap.closestDistanceUnit + " " : "")
    //             )
    //         } else {
    //              console.log(
    //                 "              " + 
    //                 (lap.isWorkout ? lap.closestTime + " " + lap.closestTimeUnit + " " : "")
    //             );
    //         }
    //     }

        // (lap.isWorkout ? " W" : " ") + 
        // (lap.isWorkout ? " " + lap.workoutType + " ": " ") + 
        // (lap.isWorkout ? " " + lap.workoutBasis : "")
        

        // console.log( "              " + 
        //     (lap.isWorkout ? lap.closestDistance + " " + lap.closestDistanceUnit + " " : "") + 
        //     (lap.isWorkout ? lap.closestDistanceDifference + " " : "" )
        // )
        // console.log(
        //     "              " + 
        //     (lap.isWorkout ? lap.closestTime + " " + lap.closestTimeUnit + " " : "") +
        //     (lap.isWorkout ? lap.closestTimeDifference + " " : "" )
        // );
    // }
    print(" ")
}


// TODO DISCARD SUPER SLOW LAPS AS STANDING REST, SO IT DOESN'T MESS WITH CLASSIFICATION OF NORMAL REST LAPS
function tagIsWorkout(laps) {
    let minSpeed = Math.min(laps.map(lap => lap.average_speed))
    
    let isWorkoutAssignments = runKnn(laps.map(lap => { 
        return {"features": [lap.average_speed]}
    }), 2)

    // Figure out which group is workouts
    let aGroup = isWorkoutAssignments.filter(item => item.knn_temp_assignment === 0)
    let aAverage = aGroup.reduce((x, y) => x + y.features[0], 0) / aGroup.length
    let bGroup = isWorkoutAssignments.filter(item => item.knn_temp_assignment === 1)
    let bAverage = bGroup.reduce((x, y) => x + y.features[0], 0) / bGroup.length

    let workoutClusterIndex = aAverage > bAverage ? 0 : 1

    for (let idx in isWorkoutAssignments) {
        laps[idx].isWorkout = isWorkoutAssignments[idx].knn_temp_assignment === workoutClusterIndex
    }

    // console.log(" ")
    // console.log("Workouts: " + laps.filter(lap => lap.isWorkout).map(lap => lap.lap_index))
    // console.log("NonWorkouts: " + laps.filter(lap => !lap.isWorkout).map(lap => lap.lap_index))
    // console.log(" ")

    return (laps)
}

function tagWorkoutTypes(laps) {
    let workouts = laps.filter(lap => lap.isWorkout)

    // [start] K Means Clustering -based method

    // let workoutKnnInput = workouts.map(lap => {
    //     // return {"features": [lap.moving_time, lap.distance]}
    //     return {"features": [lap.distance]}
    // })
    // let wcssK = [99999] // Fill 0 with garbage so index lines up with k

    // for (let k = 1; k < 6; k++) {
    //     if (workouts.length < k) {
    //         break
    //     }
    //     let assignments = runKnn(workoutKnnInput, k)
        
    //     // Create an array of K lists containing the laps in each cluster
    //     let clusters = []
    //     for (let clusterIdx = 0; clusterIdx < k; clusterIdx++) {
    //         clusters.push(assignments.filter(lap => lap.knn_temp_assignment === clusterIdx))
    //     }

    //     let wcssPerCluster = clusters.map(cluster => computeWCSS(cluster.map(item => item.features)))
    //     let totalWCSS = wcssPerCluster.reduce((a, b) => a + b, 0)
    //     wcssK.push(totalWCSS)
    // }

    // print(wcssK)
    // [end]

    // [start] Heurstic based method
    if (workouts.length === 0) {
        return workouts
    }

    let workoutsSortedByDistance = [...workouts].sort((a, b) => a.distance < b.distance ? -1 : 1)
    let workoutTypeCounter = 0
    var prevWorkoutDistance = workoutsSortedByDistance[0].distance
    for (lap of workoutsSortedByDistance) {
        if ((lap.distance / prevWorkoutDistance) > 1.5) {
            workoutTypeCounter += 1
        }

        prevWorkoutDistance = lap.distance
        lap.workoutType = workoutTypeCounter
    }
    // [end]

    // Tag each workout lap with its basis
    for (let workoutType = 0; workoutType <= workoutTypeCounter; workoutType++) {
        let correspondingLaps = laps.filter(lap => lap.workoutType === workoutType)
        
        // [start] Standard Deviation based basis determination
        // let basis = computeBasis(correspondingLaps)
        // for (lap of correspondingLaps) {
        //     lap.workoutBasis = basis
        // }
        // [end]

        // [start] Closest known distance/time basis determination
        for (lap of correspondingLaps) {
            assignNearestDistance(lap)
            assignNearestTime(lap)
        }

        let distanceDifferenceAverage = correspondingLaps.reduce((a,b) => a + b.closestDistanceDifference, 0) / correspondingLaps.length
        let timeDifferenceAverage = correspondingLaps.reduce((a,b) => a + b.closestTimeDifference, 0) / correspondingLaps.length

        for (lap of correspondingLaps) {
            lap.workoutBasis = (distanceDifferenceAverage <= timeDifferenceAverage ? "DISTANCE" : "TIME")
        }
        // [end]
    }

    return laps
}

// Expects an object with one property, `features`, that is an array of all features to be evaluated.
// Returns the inputs array (same order) with the cluster assignments added as property `knn_temp_assignment`
function runKnn(inputs, k) {
    // Initialize uniformly into clusters
    for (let idx in inputs) {
        inputs[idx].knn_temp_assignment = idx % k
    }

    var isStable = false
    
    do {
        let previousAssignments = [...inputs]

        for (item of inputs) {
            distances = [] // Distance to each cluster
            for (let clusterIdx = 0; clusterIdx < k; clusterIdx++ ) {
                distances.push(
                    averageDistanceToCluster(
                        item.features,
                        previousAssignments
                            .filter(item => item.knn_temp_assignment === clusterIdx)
                            .map(item => item.features)
                    )
                )
            }

            // Reassign
            let clusterAssignment = distances.indexOf(Math.min(...distances))
            item.knn_temp_assignment = clusterAssignment
        }

        // Compare prev vs. new assignments
        newAssignments = [...inputs]
        isStable = arraysAreEqual(previousAssignments, newAssignments)

        // console.log(previousAssignments, newAssignments)
    } while (!isStable)

    return inputs
}

function mergeAbutingLaps(laps) {
    var mergedLaps = []
    
    var prevLap = laps[0]
    for (let lapIdx = 1; lapIdx < laps.length; lapIdx++ ) {
        // If two consequtive laps are the same type (workout vs. nonworkout), merge them
        if (prevLap.isWorkout === laps[lapIdx].isWorkout) {
            prevLap = mergeLaps(prevLap, laps[lapIdx])
        } else { // If not the same type, add the previous lap to the result array
            mergedLaps.push(prevLap)
            prevLap = laps[lapIdx]
        }
    }

    // Include the last lap
    mergedLaps.push(prevLap)

    return mergedLaps
}

// Combines the 'addition' lap into the base lap, preserves all component laps in a property called `component_laps`
function mergeLaps(base, addition) {
    const combined_elapsed_time = base.elapsed_time + addition.elapsed_time
    const combined_moving_time = base.moving_time + addition.moving_time
    const combined_distance = base.distance + addition.distance
    const combined_end_index = Math.max(base.end_index, addition.end_index)
    const combined_total_elevation_gain = base.total_elevation_gain + addition.total_elevation_gain
    const combined_average_speed = (base.distance + addition.distance) / (combined_moving_time)
    const combined_max_speed = Math.max(base.max_speed, addition.max_speed)

    if ('component_laps' in base) {
        base.component_laps.push(addition)
    } else {
        base.component_laps = [base, addition]
    }

    base.elapsed_time = combined_elapsed_time
    base.moving_time = combined_moving_time
    base.distance = combined_distance
    base.end_index = combined_end_index
    base.total_elevation_gain = combined_total_elevation_gain
    base.average_speed = combined_average_speed
    base.max_speed = combined_max_speed

    return base
}

// Given a set of laps corresponding to one type of workout, determine whether the workout was defined by time or distance
function computeBasis(workoutLaps) {
    let lapTimes = workoutLaps.map(lap => lap.moving_time)
    let totalTime = lapTimes.reduce((a, b) => a + b, 0)
    let lapTimesNormalized = lapTimes.map(time => time / totalTime)
    let avgLapTime = totalTime / workoutLaps.length
    let lapTimeStdDev = standardDeviation(lapTimes)

    let lapDistances = workoutLaps.map(lap => lap.distance)
    let totalDistance = lapDistances.reduce((a, b) => a + b, 0)
    let lapDistancesNormalized = lapDistances.map(distance => distance / totalDistance)
    let avgLapDistance = totalDistance / workoutLaps.length
    let lapDistanceStdDev = standardDeviation(lapDistances)

    let timeStdDev = standardDeviation(lapTimesNormalized)
    let distanceStdDev = standardDeviation(lapDistancesNormalized)

    // let timeScore = avgLapTime / lapTimeStdDev
    // let distanceScore = avgLapDistance / lapDistanceStdDev

    // print("timeStdD " + timeStdDev)
    // print("distStdD " + distanceStdDev)

    if (timeStdDev < distanceStdDev) {
    // if (timeScore < distanceScore) {
        return "TIME"
    } else {
        return "DISTANCE"
    }
}

// Mutates the lap, stores the best guess distance, its difference, and the unit of the distance
function assignNearestDistance(lap) {
    // In meters
    let validDistancesMeters = [
        100,
        200,
        300,
        400,
        500,
        600,
        800,
        1000,
        1200,
        1500,
        // 1600,
        2000,
        3000,
        5000,
        10000,
    ]

    let validDistanceMiles = [
        1609, // 1 mile
        3218.7, // 2 miles
        4828, // 3 miles
        6437.4, // 4 miles
        8046.7, // 5 miles
        16090, // 10 miles
    ]

    let validDistanceMarathons = [
        21097.5, // half marathon
        42195, // marathon
    ]

    let lapDist = lap.distance
    lap.closestDistance = 0
    lap.closestDistanceDifference = 1

    for (let guess of validDistancesMeters) {
        let difference = Math.abs(lapDist - guess) / guess
        if (difference < lap.closestDistanceDifference) {
            assignDistanceGuess(guess, difference, "meter")
        }
    }

    for (let guess of validDistanceMiles) {
        let difference = Math.abs(lapDist - guess) / guess
        if (difference < lap.closestDistanceDifference) {
            assignDistanceGuess(metersToMilesRounded(guess), difference, "mile")
        }
    }
}

function assignDistanceGuess(distance, difference, unit) {
    lap.closestDistance = distance
    lap.closestDistanceUnit = unit + (distance > 1 ? "s" : "")
    lap.closestDistanceDifference = difference
}

function assignNearestTime(lap) {
    // In seconds
    let validTimesSeconds = [
        15,
        20,
        30,
        45
    ]

    let validTimesMinutes = [
        60,
        90,
        120, // 2
        150,
        180, // 3
        210,
        240, // 4
        270,
        300, // 5
        // 330,
        // 360, // 6
        // 390,
        // 420, // 7
        450,
        // 480, // 8
        // 510,
        // 540, // 9
        // 570,
        600, // 10
        // 660, // 11
        720, // 12
        // 780, // 13
        // 840, // 14
        900, // 15
        // 960, // 16
        // 1020, // 17
        // 1080, // 18
        // 1140, // 19
        1200, // 20
        1500, // 25
        1800 // 30
    ]

    lapTime = lap.moving_time
    lap.closestTime = 0
    lap.closestTimeDifference = 1

    for (time of validTimesSeconds) {
        let difference = Math.abs(time - lapTime) / time
        if (difference < lap.closestTimeDifference) {
            assignTimeGuess(time, difference, "second")
        }
    }

    for (time of validTimesMinutes) {
        let difference = Math.abs(time - lapTime) / time
        if (difference < lap.closestTimeDifference) {
            assignTimeGuess(secondsToMinutes(time), difference, "minute")
        }
    }
}

function assignTimeGuess(time, difference, unit) {
    lap.closestTime = time
    lap.closestTimeUnit = unit + (time > 1 ? "s" : "")
    lap.closestTimeDifference = difference
}

function patternReducer(pattern, list) {
    let patternIdx = 0
    let listIdx = 0
    let isMatching = pattern[0] === list[0]
    let matchesFound = 0
    
    while (isMatching && listIdx < list.length) {
      if (pattern[patternIdx] === list[listIdx]) {
        listIdx += 1
        patternIdx = (patternIdx + 1 ) % pattern.length
        
        if (patternIdx === 0) {
          matchesFound += 1
        }
      } else {
        isMatching = false
      }
    }
  
    return {
      "matchCount": matchesFound,
      "unmatchedRemainder": list.slice(listIdx)
    }
}

function extractPatterns(laps) {
    let i = 0
    let patterns = []
    let patternLength = 1
    
    while (i < laps.length) {
        let patternGuess = laps.slice(i, i + patternLength).map(lap => lap.workoutType)
        let attemptedReduction = patternReducer(patternGuess, laps.slice(i + patternLength).map(lap => lap.workoutType)) // start at `+ patternLength` to avoid matching the initial pattern
        
        if (attemptedReduction.matchCount > 0) {
            let matching = laps.slice(i, patternLength * (attemptedReduction.matchCount + 1))
            patterns.push({
                "pattern": patternGuess,
                "count": attemptedReduction.matchCount + 1, // + 1 to include the initial pattern
                "laps": laps.slice(i, i + (patternLength * (attemptedReduction.matchCount + 1)))
            })

            i += patternLength * (attemptedReduction.matchCount + 1) // + 1 to include the initial pattern
            patternLength = 1
        } else {
            // Keep increasing the pattern length to try longer patterns
            if (patternLength < laps.length - i) {
                patternLength = patternLength + 1
            } else {
                // If no pattern starting here is found, add as a single element and move on
                patterns.push({
                    "pattern": [laps[i].workoutType],
                    "count": 1,
                    "laps": [laps[i]]
                })

                i += 1
                patternLength = 1
            }
        }
    }

    return patterns
    // console.log("-------- " + laps)
    // console.log(patterns)
    // console.log(" ")
}

function printSets(sets) {
    let output = ""
    for (set of sets) {
        // Set name
        let tokenLap = set.laps[0]
        let setDescription = ""

        let lapName = tokenLap.workoutBasis === "DISTANCE" 
            ? tokenLap.closestDistance + " " + tokenLap.closestDistanceUnit
            : tokenLap.closestTime + " " + tokenLap.closestTimeUnit

        if (set.count === 1) {
            setDescription += lapName
        } else {
            setDescription += set.count + " x " + lapName
        }

        setDescription += "\n"
        setDescription += indented((set.laps.length === 1 ? "" : "Avg. " ) + "Pace: " + averagePaceOfSet(set) + "/mi")

        if (set.laps[0].workoutBasis === "DISTANCE") {
            setDescription += indented((set.laps.length === 1 ? "" : "Avg. " ) + "Time: " + averageTimeOfSetFormatted(set))
        } else if (set.laps[0].workoutBasis === "TIME") {
            setDescription += indented((set.laps.length === 1 ? "" : "Avg. " ) + "Dist: " + averageDistanceOfSetFormatted(set))
        }
        output += setDescription

        if (set.laps.length > 1) {
            // List the individual laps
            // Lap > 1mi: mile pace
            // Lap < 1mi: time if basis DISTANCE, distance if basis TIME

            let lapDetails = ""

            if (tokenLap.closestDistanceUnit === "mile") {
                for (let lap of set.laps) {
                    lapDetails += pacePerMileFormatted(lap) + "/mi, "
                }
            } else {
                if (tokenLap.workoutBasis === "DISTANCE") {
                    for (let lap of set.laps) {
                        lapDetails += secondsToTimeFormatted(lap.moving_time) + ", "
                    }
                } else if (tokenLap.workoutBasis === "TIME") {
                    for (let lap of set.laps) {
                        lapDetails += (Math.round(lap.distance )) + "m, "
                    }
                }
            }

            output += indented("Laps: " + lapDetails.slice(0, -2)) // slice to remove ending ", "
        } else if (set.laps.length === 1 && metersToMiles(set.laps[0].distance) > 1) {
            // List the splits
            let tokenLap = set.laps[0]
            if ("component_laps" in tokenLap) {
                let splits = ""

                for (let lap of tokenLap.component_laps) {
                    if (metersToMiles(lap.distance) >= .5) {
                        splits += pacePerMileFormatted(lap) + "/mi, "
                    }
                }

                output += indented("Splits: " + splits.slice(0, -2))
            }

        }

        output += "\n"
    }

    return output
}

function indented(input, indentLevel = 1) {
    return "  ".repeat(indentLevel) + input + "\n"
}

//
//
//
// Helper functions
//
//
//


// Just an average of all the individual points across the same position in the vector
function averageDistanceToCluster(item, cluster) {
    if (cluster.length === 0) {
        return 999999999
    }
    let centroidFeature = computeCentroid(cluster)
    return distanceBetweenNDPoints(centroidFeature, item)
}

function distanceBetweenNDPoints(a, b) {
    let featureCount = a.length
    let resultVector = []

    for (let i = 0; i < featureCount; i++) {
        resultVector[i] = Math.pow(a[i] - b[i], 2)
    }

    return Math.pow(resultVector.reduce((a, b) => a + b, 0), 0.5)
}

function computeCentroid(cluster) {
    let featureCount = cluster[0].length
    let centroidFeature = []

    for (let i = 0; i < featureCount; i++) {
        centroidFeature.push(cluster.reduce((a, b) => a + b[i], 0) / cluster.length)
    }

    return centroidFeature
}

// Within Cluster Sum of Squares
function computeWCSS(cluster) {
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

function standardDeviation(items) {
    let average = items.reduce((a, b) => a + b, 0) / items.length
    let sumOfSquares = items.reduce((a, b) => a + Math.pow(b - average, 2), 0)
    let stdDev = Math.pow(sumOfSquares / items.length, 0.5)

    return stdDev
}

function arraysAreEqual(a, b) {
    return a.length === b.length && a.every((val, index) => val === b[index]);
}

function newArrayWithNNested(n) {
    var result = []
    for (let i = 0; i < n; i++) {
        result.push([])
    }

    return result
}

function metersToMiles(meters) {
    return meters * 0.000621371
}

function metersToMilesRounded(meters) {
    return Math.round(metersToMiles(meters))
}

function secondsToMinutes(seconds) {
    if (seconds % 60 === 30) { // half minute
        return Math.round((seconds - 30) / 60) + 0.5
    } else {
        return Math.round(seconds / 60)
    }
}

function secondsToTimeFormatted(seconds) {
    let minutes = Math.floor(seconds / 60)
    let shouldRound = minutes > 0 // Only round if less than 1min
    let secondsRes = secondsFormatter(seconds % 60, shouldRound)

    if (minutes === 0) {
        return (minutes + secondsRes.minuteDiff) + ":" + secondsRes.seconds
    } else {
        return (minutes + secondsRes.minuteDiff) + ":" + secondsRes.seconds
    }
}

function secondsPerMile(lap) {
    let distanceMiles = metersToMiles(lap.distance)
    let secondsPerMile = lap.moving_time / distanceMiles

    return secondsPerMile
}

function pacePerMileFormatted(lap) {
    return secondsToTimeFormatted(secondsPerMile(lap))
}

function averagePaceOfSet(set) {
    let totalTime = set.laps.reduce((a, b) => a + b.moving_time, 0)
    let totalDistance = set.laps.reduce((a, b) => a + b.distance, 0)

    return pacePerMileFormatted({"distance": totalDistance, "moving_time": totalTime})
}

function averageTimeOfSetFormatted(set) {
    let averageSeconds = set.laps.reduce((a, b) => a + b.moving_time, 0) / set.laps.length
    return secondsToTimeFormatted(averageSeconds)
}

function averageDistanceOfSetFormatted(set) {
    let averageDistance = set.laps.reduce((a, b) => a + b.distance, 0) / set.laps.length
    let roundedMiles = metersToMiles(averageDistance).toFixed(2)

    return roundedMiles
}

function secondsFormatter(input, shouldRound) {
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