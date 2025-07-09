import mongoose, { Schema } from 'mongoose';
import { DAILY_CREDITS_LIMIT } from '../constants/constants';

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        trim: true,
        default: null
    },
    clerkId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    credits: {
        type: Number,
        default: DAILY_CREDITS_LIMIT
    },
    dailyCreditsRefresh: {
        type: Date,
        default: Date.now
    },
}, {
    timestamps: true,
})

const User = mongoose.model('User', UserSchema);
export default User;