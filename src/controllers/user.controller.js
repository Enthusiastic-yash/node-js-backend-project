import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"




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
}


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
})

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
})


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { refreshToken: undefined }
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
})


export { registerUser, loginUser, logoutUser }