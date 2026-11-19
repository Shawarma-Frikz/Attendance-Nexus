import {useEffect, useState} from "react";
import {ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || "").replace(/\/$/, "");
const TOKEN_KEY = "nexus.student.session";
type Student = {student_code:string; first_name:string; surname:string; class_name:string; email:string|null; profile_photo_available:boolean};
type Attendance = {id:string; status:string; elapsed_seconds:number; attendance:string}|null;
type MobileReply = {access_token:string; token_type:string; expires_in:number; student:Student; session:Attendance};

async function api<T>(path:string, token?:string, body?:unknown, method="GET"):Promise<T> {
  if (!API_BASE) throw new Error("Set EXPO_PUBLIC_API_BASE in mobile/.env to the computer's HTTPS address, for example https://192.168.1.140:8443.");
  const response = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? method : method === "GET" ? "POST" : method,
    headers: {"Content-Type":"application/json", ...(token ? {Authorization:`Bearer ${token}`} : {})},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(()=>({detail:"The NEXUS server did not return JSON."}));
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
  return data as T;
}

function PrimaryButton({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button,secondary&&styles.buttonSecondary,disabled&&styles.disabled]}>
    <Text style={[styles.buttonText,secondary&&styles.buttonTextSecondary]}>{title}</Text>
  </Pressable>;
}

export default function App() {
  const [booting,setBooting]=useState(true),[token,setToken]=useState<string|null>(null),[student,setStudent]=useState<Student|null>(null),[attendance,setAttendance]=useState<Attendance>(null),[photo,setPhoto]=useState<string|null>(null);
  const [code,setCode]=useState(""),[password,setPassword]=useState(""),[firstPassword,setFirstPassword]=useState(false),[newPassword,setNewPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState("");
  const [currentPassword,setCurrentPassword]=useState(""),[changePassword,setChangePassword]=useState(false),[claim,setClaim]=useState<"present"|"late">("present"),[note,setNote]=useState("I am in class. Please rescan me."),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");

  async function applyLogin(result:MobileReply) {
    await SecureStore.setItemAsync(TOKEN_KEY,result.access_token);
    setToken(result.access_token);setStudent(result.student);setAttendance(result.session);setPhoto(null);setPassword("");
    const photoResult=await api<{image_data:string|null}>("/api/phone/profile-photo",result.access_token).catch(()=>({image_data:null}));
    setPhoto(photoResult.image_data);
  }

  async function loadStudent(savedToken:string) {
    const result=await api<{student:Student;session:Attendance}>("/api/phone/me",savedToken);
    setToken(savedToken);setStudent(result.student);setAttendance(result.session);
    const photoResult=await api<{image_data:string|null}>("/api/phone/profile-photo",savedToken).catch(()=>({image_data:null}));
    setPhoto(photoResult.image_data);
  }

  useEffect(()=>{let active=true;(async()=>{try{const saved=await SecureStore.getItemAsync(TOKEN_KEY);if(saved)await loadStudent(saved)}catch{await SecureStore.deleteItemAsync(TOKEN_KEY)}finally{if(active)setBooting(false)}})();return()=>{active=false}},[]);

  async function login() {
    setBusy(true);setError("");setMessage("");
    try {const result=await api<MobileReply|{must_change_password:boolean}>("/api/phone/login",undefined,{student_code:code.trim().toUpperCase(),password,mobile_session:true});
      if("must_change_password" in result&&result.must_change_password){setFirstPassword(true);setError("");return}
      await applyLogin(result as MobileReply);
    } catch(e:any){setError(e.message)} finally{setBusy(false)}
  }

  async function setInitialPassword() {
    setBusy(true);setError("");setMessage("");
    try {
      if(newPassword!==confirmPassword)throw new Error("The passwords do not match.");
      await api("/api/phone/first-password",undefined,{student_code:code.trim().toUpperCase(),temporary_pin:password,new_password:newPassword});
      const result=await api<MobileReply>("/api/phone/login",undefined,{student_code:code.trim().toUpperCase(),password:newPassword,mobile_session:true});
      await applyLogin(result);setFirstPassword(false);setNewPassword("");setConfirmPassword("");
      setMessage("Password updated. Your account is ready.");
    } catch(e:any){setError(e.message)} finally{setBusy(false)}
  }

  async function pickPhoto(fromCamera:boolean) {
    if(!token)return;setError("");setMessage("");
    try {
      if(fromCamera){const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted)throw new Error("Allow camera access to take a profile photo.");}
      const result=fromCamera?await ImagePicker.launchCameraAsync({mediaTypes:["images"],allowsEditing:true,aspect:[1,1],quality:.72,base64:true}):await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,aspect:[1,1],quality:.72,base64:true});
      if(result.canceled)return;const encoded=result.assets[0]?.base64;if(!encoded)throw new Error("The phone could not read that photo.");
      await api("/api/phone/profile-photo",token,{image_data:`data:image/jpeg;base64,${encoded}`});
      setPhoto(`data:image/jpeg;base64,${encoded}`);setMessage("Profile photo updated.");
    } catch(e:any){setError(e.message)}
  }

  async function removePhoto() {
    if(!token)return;try{await api("/api/phone/profile-photo",token,undefined,"DELETE");setPhoto(null);setMessage("Profile photo removed.")}catch(e:any){setError(e.message)}
  }

  async function updatePassword() {
    if(!token)return;setError("");setMessage("");
    try {
      if(newPassword!==confirmPassword)throw new Error("The new passwords do not match.");
      const result=await api<{access_token:string}>("/api/phone/change-password",token,{current_password:currentPassword,new_password:newPassword});
      await SecureStore.setItemAsync(TOKEN_KEY,result.access_token);setToken(result.access_token);setCurrentPassword("");setNewPassword("");setConfirmPassword("");setChangePassword(false);setMessage("Password changed. Other signed-in sessions were closed.");
    } catch(e:any){setError(e.message)}
  }

  async function sendNotice() {
    if(!token)return;setBusy(true);setError("");setMessage("");
    try {const result=await api<{message:string}>("/api/phone/notice-session",token,{claim,note});setMessage(result.message)}catch(e:any){setError(e.message)}finally{setBusy(false)}
  }

  async function signOut() {
    const saved=token;try{if(saved)await api("/api/phone/logout",saved,undefined,"POST")}catch{}
    await SecureStore.deleteItemAsync(TOKEN_KEY);setToken(null);setStudent(null);setAttendance(null);setPhoto(null);setPassword("");setCode("");setFirstPassword(false);setChangePassword(false);setError("");setMessage("");
  }

  if(booting)return <View style={styles.center}><ActivityIndicator color="#087f89"/><Text style={styles.muted}>Opening NEXUS…</Text></View>;

  if(!token||!student)return <KeyboardAvoidingView style={styles.center} behavior={Platform.OS==="ios"?"padding":undefined}><ScrollView contentContainerStyle={styles.loginWrap} keyboardShouldPersistTaps="handled">
    <View style={styles.brand}><Text style={styles.brandText}>NEXUS<Text style={styles.brandDot}>.</Text></Text><Text style={styles.kicker}>STUDENT COMPANION</Text></View>
    <View style={styles.card}><Text style={styles.title}>{firstPassword?"Set your new password":"Welcome back"}</Text><Text style={styles.muted}>{firstPassword?"Replace the temporary PIN from your email before continuing.":"Sign in with the student code and password from your instructor."}</Text>
      {!firstPassword&&<><Text style={styles.label}>STUDENT CODE</Text><TextInput style={styles.input} autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} placeholder="ST-2026-IDFO"/><Text style={styles.label}>PASSWORD OR FIRST-SIGN-IN PIN</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password" onSubmitEditing={login}/></>}
      {firstPassword&&<><Text style={styles.label}>NEW PASSWORD</Text><TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="At least 12 characters"/><Text style={styles.label}>CONFIRM NEW PASSWORD</Text><TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Type it again"/></>}
      <Text style={styles.help}>Use 12+ characters with uppercase and lowercase letters, a number, and a symbol.</Text>
      {error? <Text style={styles.error}>{error}</Text>:null}
      <PrimaryButton title={busy?(firstPassword?"Setting password…":"Signing in…"):firstPassword?"Set password and continue":"Sign in"} onPress={firstPassword?setInitialPassword:login} disabled={busy||(!firstPassword&&(!code||!password))||(firstPassword&&(!newPassword||!confirmPassword))}/>
      {firstPassword&&<PrimaryButton title="Back to sign in" secondary onPress={()=>{setFirstPassword(false);setError("")}}/>}
    </View>
    <Text style={styles.footer}>NEXUS student access · Keep your password private.</Text>
  </ScrollView></KeyboardAvoidingView>;

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==="ios"?"padding":undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.topRow}><View><Text style={styles.kicker}>NEXUS · STUDENT</Text><Text style={styles.title}>Your classroom</Text></View><Pressable onPress={signOut}><Text style={styles.signOut}>Sign out</Text></Pressable></View>
    <View style={styles.profileCard}>
      <View style={styles.photoWrap}>{photo?<Image source={{uri:photo}} style={styles.photo}/>:<View style={styles.avatar}><Text style={styles.avatarText}>{student.first_name[0]}{student.surname[0]}</Text></View>}</View>
      <Text style={styles.name}>{student.first_name} {student.surname}</Text><Text style={styles.muted}>{student.class_name} · {student.student_code}</Text>{student.email?<Text style={styles.muted}>{student.email}</Text>:null}
      <View style={styles.actions}><PrimaryButton title="Take photo" onPress={()=>pickPhoto(true)}/><PrimaryButton title="Choose photo" secondary onPress={()=>pickPhoto(false)}/></View>
      {photo?<Pressable onPress={removePhoto} style={styles.textButton}><Text style={styles.textButtonText}>Remove profile photo</Text></Pressable>:null}
    </View>
    <View style={styles.card}><Text style={styles.cardTitle}>Attendance</Text>{attendance?<><View style={styles.statusRow}><Text style={styles.status}>{attendance.attendance.toUpperCase()}</Text><Text style={styles.muted}>{attendance.status}</Text></View><Text style={styles.help}>If the classroom camera missed you, send a notice. The classroom camera will wake for a targeted rescan.</Text>
      <View style={styles.choiceRow}><Pressable onPress={()=>setClaim("present")} style={[styles.choice,claim==="present"&&styles.choiceSelected]}><Text style={[styles.choiceText,claim==="present"&&styles.choiceTextSelected]}>I arrived on time</Text></Pressable><Pressable onPress={()=>setClaim("late")} style={[styles.choice,claim==="late"&&styles.choiceSelected]}><Text style={[styles.choiceText,claim==="late"&&styles.choiceTextSelected]}>I arrived late</Text></Pressable></View>
      <TextInput style={[styles.input,styles.noteInput]} value={note} onChangeText={setNote} multiline placeholder="Optional note for the instructor"/><PrimaryButton title={busy?"Sending notice…":"Request a camera rescan"} onPress={sendNotice} disabled={busy}/>
    </>:<Text style={styles.muted}>There is no recent attendance session for your class.</Text>}</View>
    <View style={styles.card}><View style={styles.sectionHeader}><Text style={styles.cardTitle}>Password & security</Text><Pressable onPress={()=>setChangePassword(!changePassword)}><Text style={styles.textButtonText}>{changePassword?"Cancel":"Change password"}</Text></Pressable></View>
      {changePassword&&<><Text style={styles.label}>CURRENT PASSWORD</Text><TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Current password"/><Text style={styles.label}>NEW PASSWORD</Text><TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="At least 12 characters"/><Text style={styles.label}>CONFIRM NEW PASSWORD</Text><TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Type it again"/><Text style={styles.help}>Use uppercase and lowercase letters, a number, and a symbol.</Text><PrimaryButton title="Save new password" onPress={updatePassword} disabled={!currentPassword||!newPassword||!confirmPassword}/></>}
      {!changePassword&&<Text style={styles.help}>Your sign-in session is stored in the phone’s secure storage. Changing your password signs out other devices.</Text>}
    </View>
    {message?<Text style={styles.success}>{message}</Text>:null}{error?<Text style={styles.error}>{error}</Text>:null}
    <Text style={styles.footer}>Your name, class, and student code are managed by your instructor.</Text>
  </ScrollView></KeyboardAvoidingView>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f3f6f9"},center:{flex:1,backgroundColor:"#f3f6f9",justifyContent:"center",padding:24},loginWrap:{flexGrow:1,justifyContent:"center",padding:22,paddingTop:50},content:{padding:20,paddingTop:54,paddingBottom:42,gap:14,maxWidth:620,width:"100%",alignSelf:"center"},
  brand:{marginBottom:20},brandText:{fontSize:26,fontWeight:"900",letterSpacing:2,color:"#10253e"},brandDot:{color:"#087f89"},kicker:{fontSize:11,fontWeight:"800",letterSpacing:1.5,color:"#087f89"},title:{fontSize:25,fontWeight:"800",color:"#14283f",marginTop:4,marginBottom:7},card:{backgroundColor:"white",borderColor:"#e1e8ef",borderWidth:1,borderRadius:17,padding:18,gap:10,shadowColor:"#10253e",shadowOpacity:.05,shadowRadius:12,elevation:2},muted:{fontSize:13,color:"#6a7e93",lineHeight:19},label:{fontSize:10,fontWeight:"800",letterSpacing:.8,color:"#6a7e93",marginTop:4},input:{borderColor:"#dbe4ed",borderWidth:1,borderRadius:10,paddingHorizontal:12,paddingVertical:12,fontSize:15,color:"#14283f",backgroundColor:"#fff"},help:{fontSize:12,color:"#6a7e93",lineHeight:18},button:{minHeight:44,paddingHorizontal:14,paddingVertical:12,backgroundColor:"#087f89",borderRadius:10,alignItems:"center",justifyContent:"center",flexGrow:1},buttonSecondary:{backgroundColor:"#eff3f7",borderWidth:1,borderColor:"#e1e8ef"},buttonText:{fontSize:13,fontWeight:"800",color:"white"},buttonTextSecondary:{color:"#30475c"},disabled:{opacity:.5},error:{padding:11,borderRadius:9,backgroundColor:"#fff0f0",color:"#9f2934",fontSize:12,lineHeight:18},success:{padding:12,borderRadius:10,backgroundColor:"#eaf7ef",color:"#17653d",fontSize:13},footer:{fontSize:11,color:"#8a9aac",textAlign:"center",marginTop:8},
  topRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:3},signOut:{fontSize:13,color:"#087f89",fontWeight:"800"},profileCard:{alignItems:"center",backgroundColor:"white",borderColor:"#e1e8ef",borderWidth:1,borderRadius:17,padding:20,gap:7},photoWrap:{width:96,height:96,borderRadius:48,overflow:"hidden",marginBottom:6},photo:{width:"100%",height:"100%"},avatar:{width:"100%",height:"100%",alignItems:"center",justifyContent:"center",backgroundColor:"#e4f1f2"},avatarText:{fontSize:27,fontWeight:"900",color:"#087f89"},name:{fontSize:20,fontWeight:"800",color:"#14283f"},actions:{flexDirection:"row",gap:8,marginTop:10,width:"100%"},textButton:{padding:7},textButtonText:{color:"#087f89",fontSize:12,fontWeight:"800"},cardTitle:{fontSize:16,fontWeight:"800",color:"#14283f"},statusRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:6},status:{fontSize:14,fontWeight:"900",color:"#087f89"},choiceRow:{flexDirection:"row",gap:8,marginVertical:5},choice:{flex:1,padding:11,borderWidth:1,borderColor:"#dbe4ed",borderRadius:9,alignItems:"center"},choiceSelected:{backgroundColor:"#e4f4f4",borderColor:"#087f89"},choiceText:{fontSize:12,color:"#60748a",fontWeight:"700",textAlign:"center"},choiceTextSelected:{color:"#087f89"},noteInput:{minHeight:68,textAlignVertical:"top"},sectionHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
});
