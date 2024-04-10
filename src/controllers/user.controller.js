import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken";
import mongoose from "mongoose";




const generateAccessandRefreshToken = async (userId) => {
    try {
        //find  user from database through userID
        const user = await User.findById(userId)
        //gernerate access and refresh toke 
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        // store  generated token in database 
        user.refreshToken = refreshToken
        // when we try to save in that case mongoose model with activate and then they will ask for passwrod  so here we don't need that becase we just created refresh toke for already present user who password is already match from database
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "something went wrong while generating refresh and access token")
    }
};


const registerUser = asyncHandler(async (req, res) => {
    // get user details form frontend
    //validation not empty
    //check if user is already exists
    //check for images , check for avatar
    //  upload them to cloudinary , avtar 
    // create user object - create entry in db
    // remove password and refresh token field from response
    //check for user creation 
    // return response

    const { userName, email, password, fullName } = req.body


    if ([userName, email, password, fullName].some((filed) => filed?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
        // we can further check  is there is @ preset in email or not or you can create a seprate file for all the validation and check every ther 
    }
    const existedUSer = await User.findOne({
        $or: [{ userName }, { email }]
    })

    if (existedUSer) {
        throw new ApiError(409, 'User with email and username already exists')
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }



    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }


    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        userName: userName.toLowerCase(),
    })


    //down below  we dont want to send  this field on frontend so we can use this syntax to keep away
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "user Register successfully")
    )
});

const loginUser = asyncHandler(async (req, res) => {

    // get email  or user and password from request
    const { email, username, password } = req.body

    // check  there is email and user name field in req.body we can check base only on one for that we have to change our login like this (!(username || email))
    if (!username && !email) {
        throw new ApiError(400, 'username or email is required')
    }

    //find username or email form data base
    let user = await User.findOne({
        $or: [{ username }, { email }]
    })

    // if not user found in data base  then throw and error 
    if (!user) {
        throw new ApiError(404, "user does not exist")
    }

    // check  user password provided is same with current user who store in database for this we use our own bycript method 
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "InValid user credentials")
    }

    // here we call the funciton and passed the user id and we have now access token and refresh token
    const { accessToken, refreshToken } = await generateAccessandRefreshToken(user._id)

    //here we again find the user  with user id and remove the password and refresh token so that we can send the respose to the  user
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //now we have to set cookies to the user browser 
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                user: loggedInUser,
                accessToken,
                refreshToken
            }, "user logged in successfully"
            )
        )
});


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1   // this removes the field form document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "user logged out"))
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    // get refresh token from frontend cookies
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    // if not present throw and error 
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthroized request")
    }

    try {
        // first decode the toke that we get form frontend because the clien have token in encripted form
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        console.log("decodedToken", decodedToken)
        const user = await User.findById(decodedToken?._id)
        //if not match then throw an error 
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
        // now we have to check the token whcih has been sent by the user and  the data base  refresh token  both are same or not 
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }


        const { accessToken, newRefreshToken } = await generateAccessandRefreshToken(user._id, options)
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200,
                { accessToken, refreshToken: newRefreshToken },
                "Access Token refreshed successfully"
            )
            )

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

});


const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body
    //find user in database
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Old password")
    }
    //if everythig is correct then set the new password
    user.password = newPassword
    await user.save({ validateBeforeSave: false })
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password updated successfully"))
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "current user fetch succesfully"))
});


const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email, } = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        // new true means it will send the update information 
        { new: true }

    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "AVatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading avatar file")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }

    ).select("-password")

    return res
        .status(200)
        .json(new ApiError(200, user, "Avatar file updated successfully"))


});
const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "coverImage file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading coverImage file")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }

    ).select("-password")

    return res
        .status(200)
        .json(new ApiError(200, user[0], "coverImage file updated successfully"))

})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { userName } = req.params

    if (!userName?.trim()) {
        throw new ApiError(400, "username is missing")
    }
    // aggration pipeline
    const channel = await User.aggregate([
        {
            // here we match user name from data base
            $match: {
                userName: userName?.toLowerCase()
            },
        },
        // here we check how many subscriber he have from the base of channel
        {
            $lookup: {
                from: "subscriptions",     // this is model name but we write it here  who the name store in database
                localField: "_id",             //field from the input documents mean we search on id
                foreignField: "channel",            //field from the documents of the "from" collection
                as: "subscribers"             //output array field
            },

        },

        // here we check how many we have subscribed to others channels base on subscriber
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        // here we add the above fields to the   user document 
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },

                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },

                isSubscriber: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        // here which thing we have to show  or pass on we just have to put one  in front of that fields 
        {
            $project: {
                fullName: 1,
                username: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                isSubscriber: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])



    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, channel[0], "user channel fetched succesfully"))

})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)   // on mongodb id is basically an object so here mongoose converts that in it an id 
            }
        },
        {
            $lookup: {
                from: "Videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                //nested pipeline to get user data
                pipeline: [
                    {
                        $lookup: {
                            from: "Users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        userName: 1,
                                        avatar: 1
                                    }
                                },
                                // in above code we get result in an array and further we have to do 0 index to tackel this we use down below code
                                {
                                    $addFields: {
                                        owner: {
                                            $first: "$owner"
                                        }
                                    }
                                }

                            ]
                        }
                    }
                ]


            }
        }
    ])

    // here we use user[0] because  in aggration pipline  we have to return first value
    return res
        .status(200)
        .json(new ApiResponse(200, user[0].watchHistory, "watch history fetch successfully"))

})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}