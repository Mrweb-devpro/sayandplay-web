import {BrowserRouter,Routes,Route,Navigate} from "react-router";
import {ShellLayout} from "./shell";
import {Landing,GamePicker,NumbersHome,NumbersLevels,SpellHome,SpellModes,SpellLevels,RoadHome,RoadLevels} from "./pages";
import RoadRoute from "./RoadRush";
import NumberGameRoute from "./NumberGame";
import SpellRoute from "./SpellIt";

/** Say & Play: every screen has its own address, so the browser's Back button, refresh and bookmarks work. */
export default function App(){
 return <BrowserRouter><Routes>
   <Route element={<ShellLayout/>}>
     <Route index element={<Landing/>}/>
     <Route path="games" element={<GamePicker/>}/>
     <Route path="numbers" element={<NumbersHome/>}/>
     <Route path="numbers/levels" element={<NumbersLevels/>}/>
     <Route path="numbers/level/:n" element={<NumberGameRoute/>}/>
     <Route path="spell" element={<SpellHome/>}/>
     <Route path="spell/modes" element={<SpellModes/>}/>
     <Route path="spell/:mode" element={<SpellLevels/>}/>
     <Route path="spell/:mode/level/:n" element={<SpellRoute/>}/>
     <Route path="road" element={<RoadHome/>}/>
     <Route path="road/levels" element={<RoadLevels/>}/>
     <Route path="road/level/:n" element={<RoadRoute/>}/>
     <Route path="*" element={<Navigate to="/" replace/>}/>
   </Route>
 </Routes></BrowserRouter>;
}
