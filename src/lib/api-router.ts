import { isCloudMode } from "./supabase";
import * as cloud from "./api-supabase";
import * as local from "./api-local";

const impl = isCloudMode() ? cloud : local;

export const getMyProfile = impl.getMyProfile;
export const updateProfile = impl.updateProfile;
export const searchProfiles = impl.searchProfiles;
export const getFriendships = impl.getFriendships;
export const sendFriendRequest = impl.sendFriendRequest;
export const respondFriendship = impl.respondFriendship;
export const getConversations = impl.getConversations;
export const getConversationMembers = impl.getConversationMembers;
export const createDm = impl.createDm;
export const createGroup = impl.createGroup;
export const getMessages = impl.getMessages;
export const sendMessage = impl.sendMessage;
export const uploadFile = impl.uploadFile;
export const getFolders = impl.getFolders;
export const createFolder = impl.createFolder;
export const getFolderItems = impl.getFolderItems;
export const addFolderItem = impl.addFolderItem;
export const shareFolder = impl.shareFolder;
export const getBoards = impl.getBoards;
export const createBoard = impl.createBoard;
export const saveBoardStrokes = impl.saveBoardStrokes;
export const getDesigns = impl.getDesigns;
export const createDesign = impl.createDesign;
export const saveDesign = impl.saveDesign;
export const deleteDesign = impl.deleteDesign;
export const renameDesign = impl.renameDesign;
export const getActiveCalls = impl.getActiveCalls;
export const startCall = impl.startCall;
export const endCall = impl.endCall;

export function getDataMode(): "cloud" | "local" {
  return isCloudMode() ? "cloud" : "local";
}
