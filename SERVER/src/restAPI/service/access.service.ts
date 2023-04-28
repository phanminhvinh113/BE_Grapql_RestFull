import bcrypt from 'bcrypt'
import { User, UserKeyModel, UserLogin } from '../interface/index.interface'
import { UserModel } from '../../models.mongo/User.model'
import { FindUserByField, ROLES, ReasonStatusCode, STATE_USER, StatusCode } from '../../utils/constant'
import KeyTokenService from './keyToken.service'
import { VerifyToken, createTokenPair } from '../../auth/auth.ultils'
import { token } from 'morgan'
import { getInfoData } from '../../utils/index.utils'
import { BadRequestError, AuthFailedError, ConflictRequestError, ForbiddenError } from '../../core/error.response'
import { TrackingDevice, checkExistUser, findUserByInfo, findUserByUserName, generateKeyPair } from './user.service'
import keyTokenService from './keyToken.service'
//
class accessService {
   // REGISTER
   registerService = ({ email, password, name, IP_Device, Device }: User) =>
      new Promise(async (resolve, reject) => {
         try {
            // ERROR
            if (!email || !password || !name) throw new Error('Missing Parameter')
            //
            if (await checkExistUser(email)) {
               throw new BadRequestError('Error:Email already!')
            }
            //
            const hashPassword = bcrypt.hashSync(password, 10)
            //
            const new_user = await UserModel.create({
               name,
               email,
               password: hashPassword,
               status: STATE_USER.ACTIVE,
               roles: [ROLES.USER],
            })
            // ERROR CREATE NEW USER
            if (!new_user) throw new Error('Failed!')
            // CREATE PRIVATE AND PUBLIC KEY
            const { privateKey, publicKey } = await generateKeyPair()
            // SAVE PUBLIC TO DATABASE
            const publicKeyString = await KeyTokenService.createKeyToken({
               userId: new_user._id,
               publicKey,
               IP_Device,
               Device,
            })
            //
            if (!publicKeyString) throw new Error('PublicKey Error!')
            // CREATE TOKENS
            const tokens = await createTokenPair({ userId: new_user._id, roles: new_user.roles }, publicKey, privateKey)
            if (tokens) {
               return resolve({
                  code: 0,
                  status: 201,
                  message: 'OK!',
                  data: {
                     user: getInfoData(['name', 'roles', 'email', 'verify', 'status'], new_user),
                  },
               })
            }
            if (!token) {
               return resolve({
                  code: 0,
                  status: 200,
                  message: 'Failed!',
                  data: null,
               })
            }
            //
         } catch (error) {
            console.log(error)
            return reject(error)
         }
      })
   // LOGIN
   Login = ({ _userName, password, IP_Device, Device }: UserLogin) => {
      return new Promise(async (resolve, reject) => {
         try {
            // CHECK INPUT
            if (!_userName || !password) throw new BadRequestError('Missing Parameter!', 400)
            //FIND USER AND CHECK INFO USER
            const _user = await findUserByUserName(_userName, FindUserByField.EMAIL)
            if (!_user) throw new BadRequestError('User Name Not Exist!', 406)
            // COMPARE PASSWORD
            const matchPasword = bcrypt.compareSync(password, _user.password)
            if (!matchPasword) throw new AuthFailedError('Incorrect Password:X_01')
            //Tracking Device
            const tracking = await TrackingDevice(_user._id, IP_Device, Device)
            //  CREATE KEY PRIVATE KEY AND PUBLIC KEY
            const { privateKey, publicKey } = await generateKeyPair()
            //  CREATE TOKENS
            const tokens: any = await createTokenPair({ userId: _user._id, email: _user.email, name: _user.name }, publicKey, privateKey)
            //  CHECK _KeyTokens
            if (!tokens) throw new ConflictRequestError('Failed Loggin!')
            //SAVE TOKEN AND SEND TO USER
            if (tokens) {
               // UPDATE OR CREATE REFRESH TOKEN
               await KeyTokenService.createKeyToken({
                  userId: _user._id,
                  publicKey,
                  refreshToken: tokens.refreshToken,
                  IP_Device,
                  Device,
               })
               //RESPONSE DATA
               resolve({
                  code: StatusCode.SUCCESS,
                  message: ReasonStatusCode.SUCCESS,
                  data: {
                     _user: getInfoData(['_id', 'name', 'roles', 'email', 'verify', 'status'], _user),
                     tokens,
                  },
                  tracking,
               })
            }
         } catch (error) {
            reject(error)
         }
      })
   }
   //LOGOUT
   LogOut = (keyStore: UserKeyModel | undefined, UserInfo: User | undefined) =>
      new Promise(async (resolve, reject) => {
         try {
            if (!keyStore || !UserInfo) throw new BadRequestError('Invalid Parameter')
            // CHECK EXIST USER AND DELETE KEY  AFTER LOGOUT
            const checkUserAndDelKey = [
               findUserByInfo({
                  _id: UserInfo.userId,
                  email: UserInfo.email,
               }),
               KeyTokenService.removeKeyToken(keyStore._id),
            ]
            const [result, delkeyResult] = await Promise.all(checkUserAndDelKey)
            //
            if (!result) throw new AuthFailedError('Invalid User(DB)!')
            //
            return resolve({
               code: 0,
               status: StatusCode.SUCCESS,
               message: 'Log Out Sucess!',
               data: {
                  acknowledge: delkeyResult ? true : false,
                  deletedCount: 1,
               },
            })
         } catch (error) {
            return reject(error)
         }
      })
   // REFRESH TOKEN
   handleRefreshToken = async (refreshToken: string, _userId: string) => {
      return new Promise(async (resolve, reject) => {
         try {
            // Check if refresh token is already in use
            const findToken = await KeyTokenService.findByRefrehTokenUsed(refreshToken, _userId)
            if (findToken) {
               //DECODE TO CHECK USER
               const decodeUser: User = await VerifyToken(refreshToken, findToken.publicKey)
               //
               if (!decodeUser || !decodeUser.email || !decodeUser.userId) throw new AuthFailedError('Unauthorized User! Re_Login')
               // DELETE ALL TOKEN AND KEY IN DB OF USER
               await keyTokenService.removeKeyToken(decodeUser.userId)
               throw new ForbiddenError('Abnormal access! Please Re-Login')
            }
            // If refresh token of user hasn't been used yet
            const holderToken = await keyTokenService.findByRefreshToken(refreshToken, _userId)
            if (!holderToken) throw new AuthFailedError("User Isn't Regited!")
            const { email, userId, name, privateKey } = await VerifyToken(refreshToken, holderToken.publicKey)

            //Check Infor Of User
            const user = await findUserByInfo({ _id: userId, email })
            if (!user) throw new AuthFailedError('Unauthorized User(User Does not Exist)!')
            // Create New Pair Token
            const tokens: any = await createTokenPair({ userId, email, name }, holderToken.publicKey, privateKey)
            //
            if (!tokens) throw new AuthFailedError('Unauthorized Key!')
            // Udpdate New Token!
            await holderToken?.updateOne({
               $set: {
                  refreshToken: tokens.refreshToken,
               },
               $addToSet: {
                  refreshTokensUsed: refreshToken, // add token used into list data
               },
            })
            // SUCCESS
            return resolve({
               code: 0,
               status: StatusCode.SUCCESS,
               message: 'OK!',
               data: {
                  tokens,
               },
            })
         } catch (error) {
            return reject(error)
         }
      })
   }
}
export default new accessService()