export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  image_data?: string | null
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  messages?: Message[]
}

export interface Settings {
  user_profile: string
  behavior_instructions: string
}

export type ConversationGroup = {
  label: string
  items: Conversation[]
}
