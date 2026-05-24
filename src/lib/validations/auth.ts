import { z } from 'zod'

/**
 * Login validation schema
 */
export const loginSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

/**
 * Register validation schema
 */
export const registerSchema = z.object({
  phone: z.string()
    .min(10, 'Phone number must be at least 10 characters')
    .max(15, 'Phone number must be at most 15 characters'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be at most 100 characters'),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  email: z.string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
})

export type RegisterInput = z.infer<typeof registerSchema>

/**
 * Update user validation schema
 */
export const updateUserSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  email: z.string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  avatar: z.string()
    .url('Invalid avatar URL')
    .optional()
    .or(z.literal('')),
  isActive: z.boolean().optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

/**
 * Update user role validation schema
 */
export const updateUserRoleSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'PLAYER', 'USER']),
})

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>

/**
 * User response type (for API responses)
 */
export interface UserResponse {
  id: string
  phone: string
  email: string | null
  name: string | null
  avatar: string | null
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'PLAYER' | 'USER'
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Auth response type
 */
export interface AuthResponse {
  user: UserResponse
  token: string
}

/**
 * Transform User to UserResponse
 */
export function toUserResponse(user: {
  id: string
  phone: string
  email: string | null
  name: string | null
  avatar: string | null
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'PLAYER' | 'USER'
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}): UserResponse {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}
